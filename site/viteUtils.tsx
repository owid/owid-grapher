import React from "react"
import findBaseDir from "../settings/findBaseDir.js"
import fs from "fs-extra"
import { ENV, BAKED_BASE_URL } from "../settings/serverSettings.js"
import { POLYFILL_URL } from "./SiteConstants.js"
import type { Manifest } from "vite"

const VITE_DEV_URL = process.env.VITE_DEV_URL ?? "http://localhost:8090"

const googleFontsStyles = (
    <link
        key="google-fonts"
        href="https://fonts.googleapis.com/css?family=Lato:300,400,400i,700,700i,900|Playfair+Display:400,600,700&display=swap"
        rel="stylesheet"
    />
)

const polyfillScript = <script key="polyfill" src={POLYFILL_URL} />

interface Assets {
    styles: JSX.Element[]
    scripts: JSX.Element[]
}

const devAssets = (entry: string): Assets => {
    return {
        styles: [googleFontsStyles],
        scripts: [
            polyfillScript,
            <script
                key="vite-react-preamble" // https://vitejs.dev/guide/backend-integration.html
                type="module"
                dangerouslySetInnerHTML={{
                    __html: `import RefreshRuntime from '${VITE_DEV_URL}/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true`,
                }}
            />,
            <script
                key="vite-client"
                type="module"
                src={`${VITE_DEV_URL}/@vite/client`}
            />,
            <script
                key={entry}
                type="module"
                src={`${VITE_DEV_URL}/${entry}`}
            />,
            <script
                key="vite-plugin-checker"
                type="module"
                src={`${VITE_DEV_URL}/@vite-plugin-checker-runtime-entry`}
            />,
        ],
    }
}

const createTagsForManifestEntry = (
    manifest: Manifest,
    entry: string,
    assetBaseUrl: string
): Assets => {
    const createTags = (entry: string): JSX.Element[] => {
        const manifestEntry =
            Object.values(manifest).find((e) => e.file === entry) ??
            manifest[entry]
        let assets = [] as JSX.Element[]

        if (!manifestEntry)
            throw new Error(`Could not find manifest entry for ${entry}`)

        if (entry.endsWith(".css")) {
            assets = [
                ...assets,
                <link
                    key={entry}
                    rel="stylesheet"
                    href={`${assetBaseUrl}${manifestEntry.file}`}
                />,
            ]
        } else if (entry.match(/\.[cm]?(js|jsx|ts|tsx)$/)) {
            assets = [
                ...assets,
                <script
                    key={entry}
                    type="module"
                    src={`${assetBaseUrl}${manifestEntry.file}`}
                />,
            ]
        }
        if (manifestEntry.css) {
            assets = [...assets, ...manifestEntry.css.flatMap(createTags)]
        }
        if (manifestEntry.imports) {
            assets = [...assets, ...manifestEntry.imports.flatMap(createTags)]
        }
        return assets
    }

    const assets = createTags(entry)
    return {
        styles: assets.filter((el) => el.type === "link"),
        scripts: assets.filter((el) => el.type === "script"),
    }
}

const prodAssets = (entry: string): Assets => {
    const baseDir = findBaseDir(__dirname)
    const manifestPath = `${baseDir}/dist/manifest.json`
    let manifest
    try {
        manifest = fs.readJSONSync(manifestPath) as Manifest
    } catch (err) {
        throw new Error(
            `Could not read build manifest ('${manifestPath}'), which is required for production.`,
            { cause: err }
        )
    }

    const assetBaseUrl = `${BAKED_BASE_URL}/`
    const assets = createTagsForManifestEntry(manifest, entry, assetBaseUrl)

    return {
        styles: [googleFontsStyles, ...assets.styles],
        scripts: [polyfillScript, ...assets.scripts],
    }
}

export const viteAssets = (entry: string) =>
    ENV === "production" ? prodAssets(entry) : devAssets(entry)
