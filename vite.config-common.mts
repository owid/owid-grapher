import { PluginOption, defineConfig } from "vite"
import pluginReact from "@vitejs/plugin-react"
import pluginChecker from "vite-plugin-checker"
import { warmup as pluginWarmup } from "vite-plugin-warmup"
import * as clientSettings from "./settings/clientSettings.js"
import {
    VITE_ASSET_SITE_ENTRY,
    VITE_ENTRYPOINT_INFO,
    ViteEntryPoint,
} from "./site/viteUtils.js"

// https://vitejs.dev/config/
export const defineViteConfigForEntrypoint = (
    entrypoint: ViteEntryPoint,
    extraPlugins?: PluginOption[]
) => {
    const entrypointInfo = VITE_ENTRYPOINT_INFO[entrypoint]

    return defineConfig({
        publicDir: false, // don't copy public folder to dist
        resolve: {
            alias: {
                "@ourworldindata/grapher/src": "@ourworldindata/grapher/src", // need this for imports of @ourworldindata/grapher/src/core/grapher.scss to work

                // we alias to the packages source files in dev and prod:
                // this means we get instant dev updates when we change one of them,
                // and the prod build builds them all as esm modules, which helps with tree shaking
                // Idea from https://github.com/LinusBorg/vue-lib-template/blob/3775e49b20a7c3349dd49321cad2ed7f9d575057/packages/playground/vite.config.ts
                "@ourworldindata/grapher":
                    "@ourworldindata/grapher/src/index.ts",
                "@ourworldindata/utils": "@ourworldindata/utils/src/index.ts",
                "@ourworldindata/types": "@ourworldindata/types/src/index.ts",
                "@ourworldindata/core-table":
                    "@ourworldindata/core-table/src/index.ts",
                "@ourworldindata/components":
                    "@ourworldindata/components/src/index.ts",
            },
        },
        css: {
            devSourcemap: true,
        },
        define: {
            // Replace all clientSettings with their respective values, i.e. assign e.g. BUGNSAG_API_KEY to process.env.BUGNSAG_API_KEY
            // it's important to note that we only expose values that are present in the clientSettings file - not any other things that are stored in .env
            ...Object.fromEntries(
                Object.entries(clientSettings).map(([key, value]) => [
                    `process.env.${key}`,
                    JSON.stringify(value),
                ])
            ),
        },
        build: {
            manifest: true, // creates a manifest.json file, which we use to determine which files to load in prod
            emptyOutDir: true,
            outDir: `dist/${entrypointInfo.outDir}`,
            sourcemap: true,
            target: ["chrome66", "firefox78", "safari12"], // see docs/browser-support.md
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
                        plugins: ["decorators-legacy"], // needed so mobx decorators work correctly
                    },
                },
            }),
            pluginChecker({
                typescript: {
                    buildMode: true,
                    tsconfigPath: "tsconfig.vite-checker.json",
                },
            }),
            pluginWarmup({ clientFiles: [VITE_ASSET_SITE_ENTRY] }),
            ...(extraPlugins || []),
        ],
        server: {
            port: 8090,
        },
        preview: {
            port: 8090,
        },
    })
}
