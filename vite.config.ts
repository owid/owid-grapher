import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import * as clientSettings from "./settings/clientSettings.js"

// https://vitejs.dev/config/
export default defineConfig({
    publicDir: false,
    optimizeDeps: {
        // they are commonJS, so we need to include them here
        // https://vitejs.dev/guide/dep-pre-bundling.html#monorepos-and-linked-dependencies
        include: [
            "@ourworldindata/grapher",
            "@ourworldindata/utils",
            "@ourworldindata/core-table",
        ],
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
        lib: {
            entry: {
                owid: "./site/owid.entry.ts",
                admin: "./adminSiteClient/admin.entry.ts",
            },
            formats: ["es"],
        },
        commonjsOptions: {
            include: [/@ourworldindata\/.*/, /node_modules/],
        },
        cssCodeSplit: true,
        rollupOptions: {
            cache: false, // https://github.com/vitejs/vite/issues/2433#issuecomment-1361094727
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
    ],
    server: {
        port: 8090,
    },
    preview: {
        port: 8090,
    },
})
