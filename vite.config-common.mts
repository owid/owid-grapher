import { defineConfig, withFilter } from "vite"
import pluginReact from "@vitejs/plugin-react"
import pluginSwc from "@rollup/plugin-swc"
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
        build: {
            manifest: true, // creates a manifest.json file, which we use to determine which files to load in prod
            emptyOutDir: true,
            outDir: `dist/${entrypointInfo.outDir}`,
            sourcemap: true,
            target: ["chrome106", "firefox110", "safari16.0"], // see docs/browser-support.md
            commonjsOptions: {
                strictRequires: "auto",
            },
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
            withFilter(
                // Use swc to transform decorators, since rolldown/oxc doesn't support modern decorators yet. We could remove this once they do - see https://github.com/oxc-project/oxc/issues/9170.
                pluginSwc({
                    swc: {
                        jsc: {
                            parser: {
                                syntax: "typescript",
                                decorators: true,
                            },
                            transform: {
                                decoratorVersion: "2023-11" as any, // @swc/types@0.1.25 doesn't have the now-supported decorator version 2023-11 yet, but swc supports it
                                useDefineForClassFields: true,
                            },

                            // This setting we need to override from @rollup/plugin-swc's default, otherwise it will not put optional properties on classes (e.g. `class A { optionalProp?: string }`), thereby breaking mobx decorators
                            loose: false,
                            target: "esnext",
                        },
                    },
                }),
                // Only run this transform if the file contains a decorator.
                { transform: { code: /[^"]@/, id: /.*\.(ts|tsx)$/ } }
            ),
            pluginReact(),
            withFilter(
                optimizeReactAriaLocales.vite({
                    locales: ["en-US"],
                }),
                {
                    transform: {
                        // This filter is taken directly from the plugin itself: https://github.com/adobe/react-spectrum/blob/b5cbf5bcf32edc6350b8051e390c003013223d93/packages/dev/optimize-locales-plugin/LocalesPlugin.js#L20
                        // But adding this filter on the rolldown level is way more efficient, which is why we duplicate it here.
                        id: /[/\\](@react-stately|@react-aria|@react-spectrum|react-aria-components)[/\\]/,
                    },
                }
            ),
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
