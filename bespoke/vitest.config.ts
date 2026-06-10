import { defineConfig } from "vitest/config"
import { withFilter } from "vite"
import pluginReact from "@vitejs/plugin-react"
import pluginSwc from "@rollup/plugin-swc"

export default defineConfig({
    plugins: [
        withFilter(
            // Use swc to transform decorators, since rolldown/oxc doesn't
            // support modern decorators yet. We could remove this once they do
            // - see https://github.com/oxc-project/oxc/issues/9170.
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
                        // This setting we need to override from
                        // @rollup/plugin-swc's default, otherwise it will not
                        // put optional properties on classes (e.g.
                        // `class A { optionalProp?: string }`), thereby breaking
                        // mobx decorators
                        loose: false,
                        target: "esnext",
                    },
                },
            }),
            // Only run this transform if the file contains a decorator.
            { transform: { code: /[^"]@/, id: /.*\.(ts|tsx)$/ } }
        ),
        pluginReact(),
    ],
    test: {
        root: ".",
    },
})
