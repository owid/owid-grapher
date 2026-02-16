import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
    root: "./src",
    base: "/admin",
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    build: {
        lib: {
            entry: ["main.tsx", "main.scss"],
            fileName: "income-plots",
            formats: ["es"],
        },
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
    server: {
        allowedHosts: true,
    },
})
