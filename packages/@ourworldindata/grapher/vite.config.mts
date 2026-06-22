import { defineConfig } from "vite"
// oxlint-disable-next-line import-x-js/no-relative-packages -- vite config is reaching outside of the package, which is okay here
import { BUILD_TARGET, commonPlugins } from "../../../vite.config-common.mts"

export default defineConfig(({ mode }) => {
    const isCdn = mode === "cdn"

    return {
        build: {
            lib: {
                entry: "src/grapher.entry.ts",
                formats: ["es"],
                fileName: isCdn ? "grapher.bundle" : "grapher",
            },
            minify: isCdn,
            sourcemap: true,
            emptyOutDir: !isCdn, // preserve npm build output when building CDN
            target: BUILD_TARGET,
            rolldownOptions: {
                external: isCdn ? [] : [/^react($|\/)/, /^react-dom($|\/)/],
                output: {
                    assetFileNames: "grapher.[ext]",
                },
            },
        },
        define: {
            "process.env.NODE_ENV": JSON.stringify("production"),
        },
        plugins: commonPlugins(),
    }
})
