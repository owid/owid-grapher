import { defineConfig } from "vite"
import pluginReact from "@vitejs/plugin-react"
import optimizeReactAriaLocales from "@react-aria/optimize-locales-plugin"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import * as clientSettings from "./settings/clientSettings.js"
import {
    VITE_ASSET_SITE_ENTRY,
    VITE_ENTRYPOINT_INFO,
    ViteEntryPoint,
} from "./site/viteConstants.js"

// https://vitejs.dev/config/
export const defineViteConfigForEntrypoint = (entrypoint: ViteEntryPoint) => {
    const entrypointInfo = VITE_ENTRYPOINT_INFO[entrypoint]
    const isBundlemon = process.env.BUNDLEMON === "true"
    const vitePort = parseInt(process.env.VITE_PORT || "8090", 10)

    return defineConfig({
        publicDir: false, // don't copy public folder to dist
        css: {
            devSourcemap: true,
            preprocessorOptions: {
                scss: {
                    // Prevent reintroducing deprecated features.
                    fatalDeprecations: [
                        "color-functions",
                        "global-builtin",
                        "mixed-decls",
                        "slash-div",
                    ],
                    quietDeps: true,
                    silenceDeprecations: [
                        // We don't want to deal with the import warnings for now.
                        // https://sass-lang.com/documentation/breaking-changes/import/
                        //
                        // Some of them come from dependencies. For example,
                        // they should be fixed in the upcoming Bootstrap 6.
                        // https://github.com/twbs/bootstrap/issues/29853
                        "import",
                    ],
                },
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
        },
        esbuild: {
            target: "es2024", // needed so decorators are compiled by esbuild
        },
        build: {
            manifest: true, // creates a manifest.json file, which we use to determine which files to load in prod
            emptyOutDir: true,
            outDir: `dist/${entrypointInfo.outDir}`,
            sourcemap: true,
            target: ["chrome91", "firefox91", "safari14.1"], // see docs/browser-support.md
            commonjsOptions: {
                strictRequires: "auto",
            },
            rollupOptions: {
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
            pluginReact({
                babel: {
                    parserOpts: {
                        plugins: ["decorators"], // needed so mobx decorators work correctly
                    },
                },
            }),
            {
                ...optimizeReactAriaLocales.vite({
                    locales: ["en-US"],
                }),
                enforce: "pre",
            },
            // Put the Sentry vite plugin after all other plugins.
            clientSettings.LOAD_SENTRY &&
                sentryVitePlugin({
                    authToken: process.env.SENTRY_AUTH_TOKEN,
                    org: process.env.SENTRY_ORG,
                    project: entrypoint === "admin" ? "admin" : "website",

                    // When running inside Bundlemon, we want the output file size to be totally deterministic, and
                    // therefore don't want sentry to inject any release information.
                    release: isBundlemon
                        ? {
                              create: false,
                              inject: false,
                          }
                        : undefined,
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
