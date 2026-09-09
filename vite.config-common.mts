import { defineConfig, type PluginOption } from "vite"
import pluginReact from "@vitejs/plugin-react"
import optimizeReactAriaLocales from "@react-aria/optimize-locales-plugin"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import {
    BUILD_TARGET,
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
    optimizeReactAriaLocales.vite({
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
        define: {
            // Replace all clientSettings with their respective values, i.e. assign e.g. EXAMPLE_ENV_VAR to process.env.EXAMPLE_ENV_VAR
            // it's important to note that we only expose values that are present in the clientSettings file - not any other things that are stored in .env
            ...Object.fromEntries(
                Object.entries(clientSettings).map(([key, value]) => [
                    `process.env.${key}`,
                    JSON.stringify(value?.toString()), // We need to stringify e.g. `true` to `"true"`, so that it's correctly parsed _again_
                ])
            ),
            // DIAGNOSTIC ONLY - DO NOT MERGE. react-dom/client picks its
            // dev/prod bundle from a runtime `process.env.NODE_ENV` check, so
            // this is what pulls in react-dom-client.development.js. Its
            // reconciler frames keep their real names, which is the whole
            // point: the production build's internals are pre-mangled, so
            // disabling our own minifier alone would still leave us with
            // two-letter symbols.
            "process.env.NODE_ENV": '"development"',
        },
        resolve: {
            alias: {
                // We don't want to load dotenv in the browser build, and don't need to fill in node imports like fs or path.
                "./loadDotenv.js": "./loadDotenv.browser.js",
            },
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
            // DIAGNOSTIC ONLY - DO NOT MERGE. Keeps our own bundle readable
            // so the frames around React's reconciler are legible too.
            minify: false,
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
