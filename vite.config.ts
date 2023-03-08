import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import checker from "vite-plugin-checker"
import * as clientSettings from "./settings/clientSettings.js"

// https://vitejs.dev/config/
export default defineConfig({
    publicDir: false,
    resolve: {
        alias: {
            // we alias to the lib's source files in dev
            // so we don't need to rebuild the lib over and over again
            // Idea from https://github.com/LinusBorg/vue-lib-template/blob/3775e49b20a7c3349dd49321cad2ed7f9d575057/packages/playground/vite.config.ts
            "@ourworldindata/grapher/src": "@ourworldindata/grapher/src",
            "@ourworldindata/grapher":
                process.env.NODE_ENV === "production"
                    ? "@ourworldindata/grapher"
                    : "@ourworldindata/grapher/src/index.ts",
            "@ourworldindata/utils":
                process.env.NODE_ENV === "production"
                    ? "@ourworldindata/utils"
                    : "@ourworldindata/utils/src/index.ts",
            "@ourworldindata/core-table":
                process.env.NODE_ENV === "production"
                    ? "@ourworldindata/core-table"
                    : "@ourworldindata/core-table/src/index.ts",
        },
    },
    define: {
        ...Object.fromEntries(
            Object.entries(clientSettings).map(([key, value]) => [
                `process.env.${key}`,
                JSON.stringify(value),
            ])
        ),
    },
    build: {
        manifest: true,
        emptyOutDir: true,
        outDir: "dist",
        sourcemap: true,
        commonjsOptions: {
            include: [/@ourworldindata\/.*/, /node_modules/],
        },
        cssCodeSplit: true,
        rollupOptions: {
            cache: false, // https://github.com/vitejs/vite/issues/2433#issuecomment-1361094727
            input: {
                owid: "./site/owid.entry.ts",
                admin: "./adminSiteClient/admin.entry.ts",
            },
            output: {
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith(".css")) {
                        if (assetInfo.name.includes("admin")) {
                            return "assets/admin.css"
                        } else if (assetInfo.name.includes("owid")) {
                            return "assets/owid.css"
                        } else {
                            return "assets/common.css"
                        }
                    }
                    return "assets/[name]-[hash][extname]"
                },
                chunkFileNames() {
                    // there's only one chunk currently, so we can do this
                    return "assets/common.mjs"
                },
                entryFileNames(entryInfo) {
                    if (entryInfo.name === "admin") {
                        return "assets/admin.mjs"
                    } else if (entryInfo.name === "owid") {
                        return "assets/owid.mjs"
                    }
                    return "assets/[name]-[hash][extname]"
                },
            },
        },
    },
    plugins: [
        react({
            babel: {
                parserOpts: {
                    plugins: ["decorators-legacy"],
                },
            },
        }),
        checker({
            typescript: {
                buildMode: true,
                tsconfigPath: "tsconfig.vite-checker.json",
            },
        }),
    ],
    server: {
        port: 8090,
    },
    preview: {
        port: 8090,
    },
})
