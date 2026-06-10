import { defineConfig, type Plugin, withFilter } from "vite"
import pluginReact from "@vitejs/plugin-react"
import pluginSwc from "@rollup/plugin-swc"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import * as clientSettings from "./settings/clientSettings.js"
import {
    VITE_ASSET_SITE_ENTRY,
    VITE_ENTRYPOINT_INFO,
    ViteEntryPoint,
} from "./site/viteConstants.js"

// https://vitejs.dev/config/
export const defineViteConfigForEntrypoint = (entrypoint: ViteEntryPoint) => {
    const entrypointInfo = VITE_ENTRYPOINT_INFO[entrypoint]
    const isBundlemon = process.env.BUNDLEMON === "true"
    const vitePort = parseInt(process.env.VITE_PORT || "8090", 10)

    return defineConfig({
        publicDir: false, // don't copy public folder to dist
        css: {
            devSourcemap: true,
            preprocessorOptions: {
                scss: {
                    // Prevent reintroducing deprecated features.
                    fatalDeprecations: [
                        "color-functions",
                        "global-builtin",
                        "mixed-decls",
                        "slash-div",
                    ],
                    quietDeps: true,
                    silenceDeprecations: [
                        // We don't want to deal with the import warnings for now.
                        // https://sass-lang.com/documentation/breaking-changes/import/
                        //
                        // Some of them come from dependencies. For example,
                        // they should be fixed in the upcoming Bootstrap 6.
                        // https://github.com/twbs/bootstrap/issues/29853
                        "import",
                    ],
                },
            },
        },
        define: Object.fromEntries(
            // Replace all clientSettings with their respective values, i.e. assign e.g. EXAMPLE_ENV_VAR to process.env.EXAMPLE_ENV_VAR
            // it's important to note that we only expose values that are present in the clientSettings file - not any other things that are stored in .env
            Object.entries(clientSettings).map(([key, value]) => [
                `process.env.${key}`,
                JSON.stringify(value?.toString()), // We need to stringify e.g. `true` to `"true"`, so that it's correctly parsed _again_
            ])
        ),
        resolve: {
            alias: {
                // We don't want to load dotenv in the browser build, and don't need to fill in node imports like fs or path.
                "./loadDotenv.js": "./loadDotenv.browser.js",
            },
        },
        build: {
            manifest: true, // creates a manifest.json file, which we use to determine which files to load in prod
            emptyOutDir: true,
            outDir: `dist/${entrypointInfo.outDir}`,
            sourcemap: true,
            target: ["chrome106", "firefox110", "safari16.0"], // see docs/browser-support.md
            commonjsOptions: {
                strictRequires: "auto",
            },
            rolldownOptions: {
                input: {
                    [entrypointInfo.outName]: entrypointInfo.entryPointFile,
                },
                output: {
                    assetFileNames: `${entrypointInfo.outName}.css`,
                    entryFileNames: `${entrypointInfo.outName}.mjs`,
                },
            },
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
            pluginOptimizeReactAriaLocales({
                locales: ["en-US"],
            }),
            // Put the Sentry vite plugin after all other plugins.
            clientSettings.LOAD_SENTRY &&
                sentryVitePlugin({
                    authToken: process.env.SENTRY_AUTH_TOKEN,
                    org: process.env.SENTRY_ORG,
                    project: entrypoint === "admin" ? "admin" : "website",

                    // When running inside Bundlemon, we want the output file size to be totally deterministic, and
                    // therefore don't want sentry to inject any release or _sentryDebugIdIdentifier information.
                    ...(isBundlemon
                        ? {
                              release: { create: false, inject: false },
                              sourcemaps: { disable: true },
                          }
                        : {}),
                }),
        ],
        server: {
            port: vitePort,
            warmup: { clientFiles: [VITE_ASSET_SITE_ENTRY] },
            // remote dev setup
            ...(process.env.VITE_HOST
                ? {
                      host: process.env.VITE_HOST,
                      cors: true,
                  }
                : {}),
        },
        preview: {
            port: vitePort,
        },
    })
}

// This plugin removes locale imports from react-aria packages.
// It is a copy of https://github.com/adobe/react-spectrum/tree/0a84129f133bc549df31ad4be17a2fe6a9bceed4/packages/dev/optimize-locales-plugin (available as @react-aria/optimize-locales-plugin on npm),
// but fixed to work correctly, and optimized (using Rolldown-native filtering).
const pluginOptimizeReactAriaLocales = ({
    locales,
}: {
    locales: readonly string[]
}): Plugin => {
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
                if (
                    !importer ||
                    options.ssr ||
                    !reactAriaPackagePathRegex.test(importer)
                )
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
