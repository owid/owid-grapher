import * as React from "react"
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
import urljoin from "url-join"

const VITE_DEV_URL = process.env.VITE_DEV_URL ?? "http://localhost:8090"

export const VITE_ASSET_SITE_ENTRY = "site/owid.entry.ts"
export const VITE_ASSET_ADMIN_ENTRY = "adminSiteClient/admin.entry.ts"

export enum ViteEntryPoint {
    Site = "site",
    Admin = "admin",
}

export const VITE_ENTRYPOINT_INFO = {
    [ViteEntryPoint.Site]: {
        entryPointFile: VITE_ASSET_SITE_ENTRY,
        outDir: "assets",
        outName: "owid",
    },
    [ViteEntryPoint.Admin]: {
        entryPointFile: VITE_ASSET_ADMIN_ENTRY,
        outDir: "assets-admin",
        outName: "admin",
    },
}

// We ALWAYS load polyfills.

const polyfillScript = <script key="polyfill" src={POLYFILL_URL} />
const polyfillPreload = (
    <link
        key="polyfill-preload"
        rel="preload"
        href={POLYFILL_URL}
        as="script"
        // Cloudflare's Early Hints generation for this URL fumbles the `&amp;` contained in this link; so we disable this for "Early Hints" for now.
        // See https://github.com/cloudflare/workers-sdk/issues/6527
        // Cloudflare disables Early Hints generation for any <link> that doesn't just contain `rel`, `href`, `as` - so the actual name of this
        // attr doesn't actually matter.
        data-cloudflare-disable-early-hints
    />
)

interface Assets {
    forHeader: React.ReactElement[]
    forFooter: React.ReactElement[]
}

// in dev: we need to load several vite core scripts and plugins; other than that we only need to load the entry point, and vite will take care of the rest.
const devAssets = (entrypoint: ViteEntryPoint, baseUrl: string): Assets => {
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
            <script
                key={entrypoint}
                type="module"
                src={`${baseUrl}/${VITE_ENTRYPOINT_INFO[entrypoint].entryPointFile}`}
            />,
        ],
    }
}

// Goes through the manifest.json files that vite creates, finds all the assets that are required for the given entry point,
// and creates the appropriate <link> and <script> tags for them.
export const createTagsForManifestEntry = (
    manifest: Manifest,
    entry: string,
    assetBaseUrl: string
): Assets => {
    const createTags = (entry: string): React.ReactElement[] => {
        const manifestEntry =
            Object.values(manifest).find((e) => e.file === entry) ??
            (manifest[entry] as ManifestChunk | undefined)
        let assets = [] as React.ReactElement[]

        if (!manifestEntry && !entry.endsWith(".css"))
            throw new Error(`Could not find manifest entry for ${entry}`)

        const assetUrl = urljoin(assetBaseUrl, manifestEntry?.file ?? entry)

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
            if (manifestEntry?.isEntry) {
                assets = [
                    ...assets,
                    <script
                        key={entry}
                        type="module"
                        src={assetUrl}
                        data-attach-owid-error-handler
                    />,
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
        if (manifestEntry?.css) {
            assets = [...manifestEntry.css.flatMap(createTags), ...assets]
        }
        if (manifestEntry?.imports) {
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
const prodAssets = (entrypoint: ViteEntryPoint, baseUrl: string): Assets => {
    const baseDir = findBaseDir(__dirname)
    const entrypointInfo = VITE_ENTRYPOINT_INFO[entrypoint]
    const manifestPath = `${baseDir}/dist/${entrypointInfo.outDir}/.vite/manifest.json`
    let manifest
    try {
        manifest = fs.readJsonSync(manifestPath) as Manifest
    } catch (err) {
        throw new Error(
            `Could not read the build manifest ('${manifestPath}'), which is required for production.
            If you're running in VITE_PREVIEW mode, wait for the build to finish and then reload this page.`,
            { cause: err }
        )
    }

    const assetBaseUrl = `${baseUrl}/${entrypointInfo.outDir}/`
    const assets = createTagsForManifestEntry(
        manifest,
        entrypointInfo.entryPointFile,
        assetBaseUrl
    )

    return {
        // sort for some kind of consistency: first modulepreload, then preload, then stylesheet
        forHeader: sortBy([polyfillPreload, ...assets.forHeader], "props.rel"),
        forFooter: [polyfillScript, ...assets.forFooter],
    }
}

const useProductionAssets = ENV === "production" || VITE_PREVIEW

const viteAssets = (entrypoint: ViteEntryPoint, prodBaseUrl?: string) =>
    useProductionAssets
        ? prodAssets(entrypoint, prodBaseUrl ?? "")
        : devAssets(entrypoint, VITE_DEV_URL)

export const viteAssetsForAdmin = () => viteAssets(ViteEntryPoint.Admin)
export const viteAssetsForSite = () => viteAssets(ViteEntryPoint.Site)

export const generateEmbedSnippet = () => {
    // Make sure we're using an absolute URL here, since we don't know in what context the embed snippet is used.
    const assets = viteAssets(ViteEntryPoint.Site, BAKED_BASE_URL)

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
