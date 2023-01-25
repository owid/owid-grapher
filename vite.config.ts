import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

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
    build: {
        manifest: true,
        emptyOutDir: false,
        outDir: "dist",
        sourcemap: true,
        lib: {
            entry: {
                owid: "./site/owid.entry.ts",
                // admin: "./adminSiteClient/admin.entry.ts",
            },
            formats: ["es"],
        },
        commonjsOptions: {
            include: [/@ourworldindata\/.*/, /node_modules/],
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
