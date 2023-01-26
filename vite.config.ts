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
