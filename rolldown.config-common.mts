// Build configuration that is shared between our vite builds (see
// vite.config-common.mts) and the standalone grapher library build, which uses
// tsdown (see packages/@ourworldindata/grapher/tsdown.config.ts).
//
// Both bundlers run on rolldown, so everything in here must only depend on
// rolldown - nothing vite-specific.
import pluginSwc from "@rollup/plugin-swc"
import type { Plugin } from "rolldown"
import { withFilter } from "rolldown/filter"
import type { DeprecationOrId } from "sass"

// see docs/browser-support.md
export const BUILD_TARGET = ["chrome106", "firefox110", "safari16.0"]

export const scssPreprocessorOptions = {
    // Prevent reintroducing deprecated features.
    fatalDeprecations: [
        "color-functions",
        "global-builtin",
        "mixed-decls",
        "slash-div",
    ] satisfies DeprecationOrId[],
    quietDeps: true,
    silenceDeprecations: [
        // We don't want to deal with the import warnings for now.
        // https://sass-lang.com/documentation/breaking-changes/import/
        //
        // Some of them come from dependencies. For example,
        // they should be fixed in the upcoming Bootstrap 6.
        // https://github.com/twbs/bootstrap/issues/29853
        "import",
    ] satisfies DeprecationOrId[],
}

// Use swc to transform decorators, since rolldown/oxc doesn't support modern decorators yet. We could remove this once they do - see https://github.com/oxc-project/oxc/issues/9170.
export const pluginSwcDecorators = (): Plugin =>
    withFilter(
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
                        // swc also transforms the JSX in the files it touches, so
                        // it needs to know to use the automatic runtime - it
                        // defaults to the classic one, which would leave behind
                        // `React.createElement` calls without a React import.
                        // (In the vite builds pluginReact papers over this, but
                        // tsdown has no such plugin.)
                        react: { runtime: "automatic" },
                    },

                    // This setting we need to override from @rollup/plugin-swc's default, otherwise it will not put optional properties on classes (e.g. `class A { optionalProp?: string }`), thereby breaking mobx decorators
                    loose: false,
                    target: "esnext",
                },
            },
        }),
        // Only run this transform if the file contains a decorator.
        { transform: { code: /[^"]@/, id: /.*\.(ts|tsx)$/ } }
    )
