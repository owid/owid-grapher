import React from "react"
import findBaseDir from "../settings/findBaseDir.js"
import fs from "fs-extra"
import {
    ENV,
    BAKED_BASE_URL,
    VITE_PREVIEW,
} from "../settings/serverSettings.js"
import { POLYFILL_URL } from "./SiteConstants.js"
import type { Manifest, ManifestChunk } from "vite"
import { sortBy } from "@ourworldindata/utils"
import path from "path"

const VITE_DEV_URL = process.env.VITE_DEV_URL ?? "http://localhost:8090"

export const VITE_ASSET_SITE_ENTRY = "site/owid.entry.ts"
export const VITE_ASSET_ADMIN_ENTRY = "adminSiteClient/admin.entry.ts"

// We ALWAYS load polyfills.

const polyfillScript = <script key="polyfill" src={POLYFILL_URL} />
const polyfillPreload = (
    <link
        key="polyfill-preload"
        rel="preload"
        href={POLYFILL_URL}
        as="script"
    />
)

interface Assets {
    forHeader: JSX.Element[]
    forFooter: JSX.Element[]
}

interface ManifestChunkWithBasePath extends ManifestChunk {
    basePath?: string
}

// in dev: we need to load several vite core scripts and plugins; other than that we only need to load the entry point, and vite will take care of the rest.
const devAssets = (entry: string, baseUrl: string): Assets => {
    return {
        forHeader: [polyfillPreload],
        forFooter: [
            polyfillScript,
            <script
                key="vite-react-preamble" // https://vitejs.dev/guide/backend-integration.html
                type="module"
                dangerouslySetInnerHTML={{
                    __html: `import RefreshRuntime from '${baseUrl}/@react-refresh'
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true`,
                }}
            />,
            <script
                key="vite-plugin-checker"
                type="module"
                src={`${baseUrl}/@vite-plugin-checker-runtime-entry`}
            />,
            <script
                key="vite-client"
                type="module"
                src={`${baseUrl}/@vite/client`}
            />,
            <script key={entry} type="module" src={`${baseUrl}/${entry}`} />,
        ],
    }
}

// Goes through the manifest.json file that vite creates, finds all the assets that are required for the entry point,
// and creates the appropriate <link> and <script> tags for them.
export const createTagsForManifestEntry = (
    manifest: Manifest,
    entry: string,
    assetBaseUrl: string
): Assets => {
    const createTags = (entry: string): JSX.Element[] => {
        const manifestEntry: ManifestChunkWithBasePath =
            Object.values(manifest).find((e) => e.file === entry) ??
            manifest[entry]
        let assets = [] as JSX.Element[]

        if (!manifestEntry)
            throw new Error(`Could not find manifest entry for ${entry}`)

        const assetUrl = path.join(
            assetBaseUrl,
            manifestEntry.basePath ?? "",
            manifestEntry.file
        )

        if (entry.endsWith(".css")) {
            assets = [
                ...assets,
                <link
                    key={`${entry}-preload`}
                    rel="preload"
                    href={assetUrl}
                    as="style"
                />,
                <link key={entry} rel="stylesheet" href={assetUrl} />,
            ]
        } else if (entry.match(/\.[cm]?(js|jsx|ts|tsx)$/)) {
            // explicitly reference the entry; preload it and its dependencies
            if (manifestEntry.isEntry) {
                assets = [
                    ...assets,
                    <script key={entry} type="module" src={assetUrl} />,
                ]
            }

            assets = [
                ...assets,
                <link
                    key={`${entry}-preload`}
                    rel="modulepreload" // see https://developer.chrome.com/blog/modulepreload/
                    href={assetUrl}
                />,
            ]
        }

        // we need to recurse into both the module imports and imported css files, and add tags for them as well
        // also, we need to take care of the order here, so the imported file is loaded before the importing file
        if (manifestEntry.css) {
            assets = [...manifestEntry.css.flatMap(createTags), ...assets]
        }
        if (manifestEntry.imports) {
            assets = [...manifestEntry.imports.flatMap(createTags), ...assets]
        }
        return assets
    }

    const assets = createTags(entry)
    return {
        forHeader: assets.filter((el) => el.type === "link"),
        forFooter: assets.filter((el) => el.type === "script"),
    }
}

// in prod: we need to make sure that we include <script> and <link> tags that are required for the entry point.
// this could be, for example: owid.mjs, common.mjs, owid.css, common.css. (plus Google Fonts and polyfills)
const prodAssets = (entry: string, baseUrl: string): Assets => {
    const baseDir = findBaseDir(__dirname)
    const manifestBasePath = `${baseDir}/dist/`
    const manifestDirs = ["assets", "admin/assets"]
    let mergedManifest
    try {
        mergedManifest = manifestDirs.reduce((acc, path) => {
            const manifestContent = fs.readJsonSync(
                `${manifestBasePath}/${path}/manifest.json`
            ) as Manifest
            Object.values(manifestContent).forEach(
                (value: ManifestChunkWithBasePath) => (value.basePath = path)
            )
            return { ...acc, ...manifestContent }
        }, {})
    } catch (err) {
        throw new Error(
            `Could not read one of the build manifests ('${manifestDirs.map((dir) => `${dir}/manifest.json`)}'), which is required for production.
            If you're running in VITE_PREVIEW mode, wait for the build to finish and then reload this page.`,
            { cause: err }
        )
    }

    const assetBaseUrl = `${baseUrl}/`
    const assets = createTagsForManifestEntry(
        mergedManifest,
        entry,
        assetBaseUrl
    )

    return {
        // sort for some kind of consistency: first modulepreload, then preload, then stylesheet
        forHeader: sortBy([polyfillPreload, ...assets.forHeader], "props.rel"),
        forFooter: [polyfillScript, ...assets.forFooter],
    }
}

const useProductionAssets = ENV === "production" || VITE_PREVIEW

export const viteAssets = (entry: string, prodBaseUrl?: string) =>
    useProductionAssets
        ? prodAssets(entry, prodBaseUrl ?? "")
        : devAssets(entry, VITE_DEV_URL)

export const generateEmbedSnippet = () => {
    // Make sure we're using an absolute URL here, since we don't know in what context the embed snippet is used.
    const assets = viteAssets(VITE_ASSET_SITE_ENTRY, BAKED_BASE_URL)

    const serializedAssets = [...assets.forHeader, ...assets.forFooter].map(
        (el) => ({
            tag: el.type,
            props: el.props,
        })
    )

    const scriptCount = serializedAssets.filter(
        (asset) =>
            asset.tag === "script" && !asset.props.dangerouslySetInnerHTML // onload doesn't fire on inline scripts, so need to handle that separately
    ).length

    return `
const assets = ${JSON.stringify(serializedAssets, undefined, 2)};
let loadedScripts = 0;

const onLoad = () => {
    loadedScripts++;
    if (loadedScripts === ${scriptCount}) {
        window.MultiEmbedderSingleton.embedAll();
    }
}

for (const asset of assets) {
    const el = document.createElement(asset.tag);
    for (const [key, value] of Object.entries(asset.props)) {
        el.setAttribute(key, value);
    }
    if (asset.props && asset.props.dangerouslySetInnerHTML) {
        el.text = asset.props.dangerouslySetInnerHTML.__html
    } else if (asset.tag === "script") {
        el.onload = onLoad;
    }
    document.head.appendChild(el);
}`
}
