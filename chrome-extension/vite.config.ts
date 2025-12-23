import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"
import {
    copyFileSync,
    mkdirSync,
    existsSync,
    readFileSync,
    writeFileSync,
} from "fs"

// Plugin to copy static files after build
function copyStaticFiles() {
    return {
        name: "copy-static-files",
        closeBundle() {
            // Create directories
            const distDir = resolve(__dirname, "dist")
            const iconsDir = resolve(distDir, "icons")
            const sidepanelDir = resolve(distDir, "sidepanel")
            if (!existsSync(iconsDir)) {
                mkdirSync(iconsDir, { recursive: true })
            }
            if (!existsSync(sidepanelDir)) {
                mkdirSync(sidepanelDir, { recursive: true })
            }

            // Copy manifest.json
            copyFileSync(
                resolve(__dirname, "manifest.json"),
                resolve(distDir, "manifest.json")
            )

            // Move HTML file to correct location (Vite outputs to src/sidepanel/)
            // and fix the relative paths
            const srcHtml = resolve(distDir, "src/sidepanel/index.html")
            const destHtml = resolve(sidepanelDir, "sidepanel.html")
            if (existsSync(srcHtml)) {
                let html = readFileSync(srcHtml, "utf-8")
                // Fix paths: ../../sidepanel/X -> ./X
                html = html.replace(/\.\.\/\.\.\/sidepanel\//g, "./")
                writeFileSync(destHtml, html)
            }

            // Copy icons from parent public folder
            const sourceIcon = resolve(
                __dirname,
                "../public/owid-logo-square.png"
            )
            if (existsSync(sourceIcon)) {
                copyFileSync(sourceIcon, resolve(iconsDir, "icon16.png"))
                copyFileSync(sourceIcon, resolve(iconsDir, "icon48.png"))
                copyFileSync(sourceIcon, resolve(iconsDir, "icon128.png"))
            }
        },
    }
}

export default defineConfig({
    plugins: [
        react({
            babel: {
                parserOpts: {
                    plugins: ["decorators"], // needed for MobX decorators
                },
            },
        }),
        copyStaticFiles(),
    ],
    base: "", // Use relative paths for Chrome extension
    esbuild: {
        target: "es2024", // needed so decorators are compiled by esbuild
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        target: ["chrome114"], // Sidepanel API minimum
        rollupOptions: {
            input: {
                "sidepanel/sidepanel": resolve(
                    __dirname,
                    "src/sidepanel/index.html"
                ),
                "background/service-worker": resolve(
                    __dirname,
                    "src/background/service-worker.ts"
                ),
                "content/content-script": resolve(
                    __dirname,
                    "src/content/content-script.ts"
                ),
            },
            output: {
                entryFileNames: "[name].js",
                chunkFileNames: "sidepanel/chunks/[name]-[hash].js",
                assetFileNames: "sidepanel/assets/[name]-[hash][extname]",
            },
        },
    },
    resolve: {
        alias: {
            "@owid": resolve(__dirname, ".."),
            // Browser-compatible shims for Node.js modules
            crypto: resolve(__dirname, "src/shims/crypto.ts"),
        },
    },
    define: {
        // Production URLs for chart rendering
        "process.env.BAKED_GRAPHER_URL": JSON.stringify(
            "https://ourworldindata.org/grapher"
        ),
        "process.env.DATA_API_URL": JSON.stringify(
            "https://api.ourworldindata.org/v1/indicators"
        ),
        "process.env.CLOUDFLARE_IMAGES_URL": JSON.stringify(
            "https://ourworldindata.org/cdn-cgi/imagedelivery/qLq-8BTgXU8yG0N6HnOy8g"
        ),
        // Stub out Node.js globals
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
})
