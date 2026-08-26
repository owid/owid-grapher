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

// `enforce` is a vite-only field for controlling plugin order, which rolldown
// ignores - but our plugins need to declare it for the vite builds.
type SharedPlugin = Plugin & { enforce?: "pre" | "post" }

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
        }) as Plugin,
        // Only run this transform if the file contains a decorator.
        { transform: { code: /[^"]@/, id: /.*\.(ts|tsx)$/ } }
    )

// This plugin removes locale imports from react-aria packages.
// It is a copy of https://github.com/adobe/react-spectrum/tree/0a84129f133bc549df31ad4be17a2fe6a9bceed4/packages/dev/optimize-locales-plugin (available as @react-aria/optimize-locales-plugin on npm),
// but fixed to work correctly, and optimized (using Rolldown-native filtering).
export const pluginOptimizeReactAriaLocales = ({
    locales,
}: {
    locales: readonly string[]
}): SharedPlugin => {
    const emptyLocaleModuleId = "\0owid-empty-react-aria-locale"
    const emptyLocaleModule = `export default undefined;`
    const reactAriaPackagePathRegex =
        /[/\\](?:@?react-stately|@?react-aria|@?react-spectrum|@?react-aria-components)[/\\]/
    const localeImportSpecifierRegex =
        /(?:^|[/\\])([a-z]{2}-[A-Z]{2})(?:\.(?:[cm]?js|json))?(?:[?#].*)?$/

    const getLocaleFromFilename = (specifier: string): string | undefined => {
        return specifier.match(localeImportSpecifierRegex)?.[1]
    }

    const getIntlLocale = (localeName: string): Intl.Locale | undefined => {
        try {
            return new Intl.Locale(localeName)
        } catch {
            return undefined
        }
    }

    const localeMatches = (
        localeToMatch: Intl.Locale,
        includedLocale: Intl.Locale
    ): boolean =>
        localeToMatch.language === includedLocale.language &&
        (!includedLocale.region ||
            localeToMatch.region === includedLocale.region)

    const includedLocales = locales.map((locale) => new Intl.Locale(locale))

    return {
        name: "owid-optimize-react-aria-locales",
        enforce: "pre",
        resolveId: {
            filter: { id: localeImportSpecifierRegex },
            handler(source, importer, options) {
                // `ssr` is only ever set by vite; the library build has no SSR pass.
                if ("ssr" in options && options.ssr) return null
                if (!importer || !reactAriaPackagePathRegex.test(importer))
                    return null

                const localeName = getLocaleFromFilename(source)
                if (!localeName) return null

                const locale = getIntlLocale(localeName)
                if (!locale) return null

                if (
                    includedLocales.some((includedLocale) =>
                        localeMatches(locale, includedLocale)
                    )
                )
                    return null

                return emptyLocaleModuleId
            },
        },
        load: {
            filter: { id: new RegExp(`^${emptyLocaleModuleId}$`) },
            handler(id) {
                if (id === emptyLocaleModuleId) return emptyLocaleModule

                return null
            },
        },
    }
}
