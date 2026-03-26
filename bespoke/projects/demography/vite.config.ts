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
    define: {
        // Libraries like MobX and core-js reference `process` and
        // `process.env.NODE_ENV`. Vite library mode doesn't shim
        // these automatically. Longer keys take precedence in Vite's
        // define, so `process.env.NODE_ENV` is replaced first, then
        // any remaining bare `process` references become `undefined`.
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env": "{}",
        process: "undefined",
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
