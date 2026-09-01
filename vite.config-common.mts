import { defineConfig, type PluginOption } from "vite"
import pluginReact from "@vitejs/plugin-react"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import {
    BUILD_TARGET,
    pluginOptimizeReactAriaLocales,
    pluginSwcDecorators,
    scssPreprocessorOptions,
} from "./rolldown.config-common.mts"
import * as clientSettings from "./settings/clientSettings.js"
import {
    VITE_ASSET_SITE_ENTRY,
    VITE_ENTRYPOINT_INFO,
    ViteEntryPoint,
} from "./site/viteConstants.js"

export const commonPlugins = (): PluginOption[] => [
    pluginSwcDecorators(),
    pluginReact(),
    pluginOptimizeReactAriaLocales({
        locales: ["en-US"],
    }),
]

// https://vitejs.dev/config/
export const defineViteConfigForEntrypoint = (entrypoint: ViteEntryPoint) => {
    const entrypointInfo = VITE_ENTRYPOINT_INFO[entrypoint]
    const isBundlemon = process.env.BUNDLEMON === "true"
    const vitePort = parseInt(process.env.VITE_PORT || "8090", 10)

    return defineConfig({
        // Resolves absolute asset urls like /fonts/*.woff2 at build time; we
        // don't copy the folder to dist (see build.copyPublicDir below).
        publicDir: "public",
        css: {
            devSourcemap: true,
            preprocessorOptions: {
                scss: scssPreprocessorOptions,
            },
        },
        define: Object.fromEntries(
            // Replace all clientSettings with their respective values, i.e. assign e.g. EXAMPLE_ENV_VAR to process.env.EXAMPLE_ENV_VAR
            // it's important to note that we only expose values that are present in the clientSettings file - not any other things that are stored in .env
            Object.entries(clientSettings).map(([key, value]) => [
                `process.env.${key}`,
                JSON.stringify(value?.toString()), // We need to stringify e.g. `true` to `"true"`, so that it's correctly parsed _again_
            ])
        ),
        resolve: {
            alias: {
                // We don't want to load dotenv in the browser build, and don't need to fill in node imports like fs or path.
                "./loadDotenv.js": "./loadDotenv.browser.js",
            },
        },
        experimental: {
            // A dynamically imported module is the one url vite has to resolve
            // in the browser rather than write into the html, and it builds it
            // from `base`. Our bundles are served from a path prefix (/assets,
            // /assets-admin, ...) that isn't the build output root, so those
            // urls came out missing the prefix and 404ed. Name the prefix here
            // instead of moving `base`, which would also rewrite the urls of
            // every asset on every page.
            //
            // Public files are exempt: they aren't copied into the bundle (see
            // build.copyPublicDir) and are served from the site root, so
            // returning undefined leaves their absolute urls alone.
            renderBuiltUrl: (filename, { type }) =>
                type === "public"
                    ? undefined
                    : `/${entrypointInfo.outDir}/${filename}`,
        },
        build: {
            manifest: true, // creates a manifest.json file, which we use to determine which files to load in prod
            emptyOutDir: true,
            copyPublicDir: false, // don't copy the public folder to dist
            // Our entry points are deliberately bundled into a single file each,
            // so the default 500 kB warning only adds noise. The site bundle
            // size is budgeted via Bundlemon instead.
            chunkSizeWarningLimit: 10_000,
            outDir: `dist/${entrypointInfo.outDir}`,
            sourcemap: true,
            target: BUILD_TARGET, // see docs/browser-support.md
            rolldownOptions: {
                input: {
                    [entrypointInfo.outName]: entrypointInfo.entryPointFile,
                },
                output: {
                    assetFileNames: `${entrypointInfo.outName}.css`,
                    entryFileNames: `${entrypointInfo.outName}.mjs`,
                },
            },
        },
        plugins: [
            ...commonPlugins(),
            // Put the Sentry vite plugin after all other plugins.
            clientSettings.LOAD_SENTRY &&
                sentryVitePlugin({
                    authToken: process.env.SENTRY_AUTH_TOKEN,
                    org: process.env.SENTRY_ORG,
                    project: entrypoint === "admin" ? "admin" : "website",

                    // When running inside Bundlemon, we want the output file size to be totally deterministic, and
                    // therefore don't want sentry to inject any release or _sentryDebugIdIdentifier information.
                    ...(isBundlemon
                        ? {
                              release: { create: false, inject: false },
                              sourcemaps: { disable: true },
                          }
                        : {}),
                }),
        ],
        server: {
            port: vitePort,
            warmup: { clientFiles: [VITE_ASSET_SITE_ENTRY] },
            // remote dev setup
            ...(process.env.VITE_HOST
                ? {
                      host: process.env.VITE_HOST,
                      cors: true,
                  }
                : {}),
        },
        preview: {
            port: vitePort,
        },
    })
}
