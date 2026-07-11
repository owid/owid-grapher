import { defineConfig } from "vite"
import pluginReact from "@vitejs/plugin-react"
import { viteCssPosition } from "vite-plugin-css-position"

import { entrypoints } from "./package.json"

export default defineConfig({
    plugins: [
        pluginReact(),
        // This plugin allows us to Vite-inject styles directly into the Shadow DOM, and still use HMR in development.
        // Use <StylesTarget /> in the React tree to specify where the styles should be injected.
        viteCssPosition({
            enableDev: true,
        }),
    ],
    resolve: {
        // The linked @ourworldindata/* packages resolve React relative
        // to their real paths, which would load a second copy of React
        // and break hooks. This forces all React imports to resolve to
        // the single copy in this project's node_modules.
        dedupe: ["react", "react-dom"],
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
