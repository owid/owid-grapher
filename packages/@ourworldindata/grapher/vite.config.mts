import { defineConfig } from "vite"
import pluginReact from "@vitejs/plugin-react"
import optimizeReactAriaLocales from "@react-aria/optimize-locales-plugin"

export default defineConfig({
    esbuild: {
        target: "es2024",
    },
    build: {
        lib: {
            entry: "src/grapher.entry.ts",
            formats: ["es"],
            fileName: "grapher",
        },
        minify: false,
        sourcemap: true,
        target: ["chrome91", "firefox91", "safari14.1"],
        rollupOptions: {
            output: {
                assetFileNames: "grapher.[ext]",
            },
        },
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    plugins: [
        pluginReact({
            babel: {
                parserOpts: {
                    plugins: ["decorators"],
                },
            },
        }),
        {
            ...optimizeReactAriaLocales.vite({
                locales: ["en-US"],
            }),
            enforce: "pre" as const,
        },
    ],
})
