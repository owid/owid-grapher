import { defineConfig, withFilter } from "vite"
import pluginReact from "@vitejs/plugin-react"
import pluginSwc from "@rollup/plugin-swc"
import optimizeReactAriaLocales from "@react-aria/optimize-locales-plugin"

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
            target: ["chrome106", "firefox110", "safari16.0"], // see docs/browser-support.md
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
        plugins: [
            withFilter(
                // Use swc to transform decorators, since rolldown/oxc doesn't support modern decorators yet. We could remove this once they do - see https://github.com/oxc-project/oxc/issues/9170.
                pluginSwc({
                    swc: {
                        jsc: {
                            parser: {
                                syntax: "typescript",
                                decorators: true,
                            },
                            transform: {
                                decoratorVersion: "2023-11",
                                useDefineForClassFields: true,
                            },

                            // This setting we need to override from @rollup/plugin-swc's default, otherwise it will not put optional properties on classes (e.g. `class A { optionalProp?: string }`), thereby breaking mobx decorators
                            loose: false,
                            target: "esnext",
                        },
                    },
                }),
                // Only run this transform if the file contains a decorator.
                { transform: { code: /[^"]@/, id: /.*\.(ts|tsx)$/ } }
            ),
            pluginReact(),
            withFilter(
                optimizeReactAriaLocales.vite({
                    locales: ["en-US"],
                }),
                {
                    transform: {
                        // This filter is taken directly from the plugin itself: https://github.com/adobe/react-spectrum/blob/b5cbf5bcf32edc6350b8051e390c003013223d93/packages/dev/optimize-locales-plugin/LocalesPlugin.js#L20
                        // But adding this filter on the rolldown level is way more efficient, which is why we duplicate it here.
                        id: /[/\\](@react-stately|@react-aria|@react-spectrum|react-aria-components)[/\\]/,
                    },
                }
            ),
        ],
    }
})
