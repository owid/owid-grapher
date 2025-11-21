import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
    root: "./src",
    base: "/admin",
    build: {
        emptyOutDir: true,
        outDir: "../../../../dist/income-plots",
    },
    esbuild: {
        target: "es2024", // needed so decorators are compiled by esbuild
    },
    plugins: [
        react({
            babel: {
                parserOpts: {
                    plugins: ["decorators"], // needed so mobx decorators work correctly
                },
            },
        }),
    ],
})
