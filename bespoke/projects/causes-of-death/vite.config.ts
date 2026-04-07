import { defineConfig, withFilter } from "vite"
import pluginReact from "@vitejs/plugin-react"
import { viteCssPosition } from "vite-plugin-css-position"
import pluginSwc from "@rollup/plugin-swc"

import { entrypoints } from "./package.json"

export default defineConfig({
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
            fileName: "index",
        },
        sourcemap: true,
        outDir: "dist",
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify(
            process.env.NODE_ENV || "development"
        ),
    },
})
