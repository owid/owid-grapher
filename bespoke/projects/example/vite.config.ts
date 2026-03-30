import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { entrypoints } from "./package.json"
import { viteCssPosition } from "vite-plugin-css-position"

export default defineConfig({
    plugins: [
        react(),
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
        dedupe: ["react", "react-dom", "@react-stately/flags"],
    },
    build: {
        lib: {
            entry: entrypoints.js,
            formats: ["es"],
            fileName: "example",
        },
        outDir: "dist",
    },
})
