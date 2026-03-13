import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { entrypoints } from "./package.json"

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: Object.values(entrypoints),
            formats: ["es"],
            fileName: "example",
        },
        cssCodeSplit: true,
        outDir: "dist",
    },
})
