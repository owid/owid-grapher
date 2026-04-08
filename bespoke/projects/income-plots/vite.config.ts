import { defineConfig } from "vite"
import pluginReact from "@vitejs/plugin-react"
import { viteCssPosition } from "vite-plugin-css-position"

import { entrypoints } from "./package.json"

export default defineConfig({
    plugins: [
        pluginReact(),
        viteCssPosition({
            enableDev: true,
        }),
    ],
    resolve: {
        dedupe: ["react", "react-dom", "@react-stately/flags"],
    },
    build: {
        lib: {
            entry: entrypoints.js,
            formats: ["es"],
            fileName: "index",
        },
        sourcemap: true,
        outDir: "dist",
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify(
            process.env.NODE_ENV || "development"
        ),
    },
})
