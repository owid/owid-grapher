import React from "react"
import findBaseDir from "../settings/findBaseDir.js"
import fs from "fs-extra"
import { ENV, BAKED_BASE_URL } from "../settings/serverSettings.js"
import { POLYFILL_URL } from "./SiteConstants.js"

const VITE_DEV_URL = process.env.VITE_DEV_URL ?? "http://localhost:8090"

const polyfillScript = <script key="polyfill" src={POLYFILL_URL} />

interface Assets {
    styles: JSX.Element[]
    scripts: JSX.Element[]
}

const devAssets = (): Assets => {
    return {
        styles: [],
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
                key="owid-entry"
                type="module"
                src={`${VITE_DEV_URL}/site/owid.entry.ts`}
            />,
        ],
    }
}

const prodAssets = (): Assets => {
    const baseDir = findBaseDir(__dirname)
    const manifestPath = `${baseDir}/dist/manifest.json`
    let manifest
    try {
        manifest = fs.readJSONSync(manifestPath)
    } catch (err) {
        throw new Error(
            `Could not read build manifest ('${manifestPath}'), which is required for production.`,
            { cause: err }
        )
    }

    const assetBaseUrl = `${BAKED_BASE_URL}/assets/`

    return {
        styles: [
            <link
                key="style.css"
                rel="stylesheet"
                href={`${assetBaseUrl}${manifest["style.css"].file}`}
            />,
        ],
        scripts: [
            polyfillScript,
            <script
                key="owid-entry"
                src={`${assetBaseUrl}${manifest["site/owid.entry.ts"].file}`}
            />,
        ],
    }
}

export const viteAssets = ENV === "production" ? prodAssets() : devAssets()
