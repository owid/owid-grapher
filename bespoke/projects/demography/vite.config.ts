import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { entrypoints } from "./package.json"

export default defineConfig({
    plugins: [react()],
    resolve: {
        // The linked @ourworldindata/* packages resolve React relative
        // to their real paths, which would load a second copy of React
        // and break hooks. This forces all React imports to resolve to
        // the single copy in this project's node_modules.
        dedupe: ["react", "react-dom", "@react-stately/flags"],
    },
    build: {
        lib: {
            entry: Object.values(entrypoints),
            formats: ["es"],
            fileName: "demography",
        },
        cssCodeSplit: true,
        outDir: "dist",
    },
})
