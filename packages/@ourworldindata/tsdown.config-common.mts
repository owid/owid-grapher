// tsdown options shared by the builds of our published npm packages
// (<package>/tsdown.config.ts).
import type { UserConfig } from "tsdown"
import optimizeReactAriaLocales from "@react-aria/optimize-locales-plugin"
import {
    BUILD_TARGET,
    pluginSwcDecorators,
    scssPreprocessorOptions,
} from "../../rolldown.config-common.mts"

// Options for every entry of a package build.
export const packageBuildOptions = {
    outDir: "./dist",
    platform: "browser",
    target: BUILD_TARGET,
    sourcemap: true,
    // Emit `.js` rather than `.mjs` - the packages are "type": "module", so
    // `.js` is unambiguous.
    fixedExtension: false,
    // Types are built by a separate entry, see dtsBundleOptions.
    dts: false,
} satisfies UserConfig

// Options for the entry that builds a package's bundled type declarations.
// Emits no JS of its own (`emitDtsOnly`).
export const dtsBundleOptions = {
    name: "types",
    // Includes the sources of the packages' workspace dependencies so their
    // types can be inlined into the bundle.
    tsconfig: "../tsconfig.tsdown.json",
    deps: {
        // Types from our own workspace packages (@ourworldindata/*) are
        // inlined into the bundle, all other imports stay external.
        alwaysBundle: [/^@ourworldindata\//],
        // The workspace packages we inline have their own dependencies
        // (dayjs, zod, ...) that aren't in the package's package.json, so
        // tsdown wouldn't auto-externalize them. Everything that's not a
        // relative import or a workspace package must stay external.
        neverBundle: (id: string) =>
            !id.startsWith(".") &&
            !id.startsWith("/") &&
            !id.startsWith("@ourworldindata/"),
    },
    // Drop side-effect-only imports (`import "dayjs"`) of external modules
    // from the bundle — consumers may not have those packages installed.
    treeshake: { moduleSideEffects: false },
    dts: { emitDtsOnly: true },
} satisfies UserConfig

// React and react-dom, which the React packages leave external in their
// `./react` build: they're peer dependencies there.
export const REACT_EXTERNALS = [/^react($|\/)/, /^react-dom($|\/)/]

// Options for every entry of a package that bundles grapher's React UI.
export const reactPackageBuildOptions = {
    ...packageBuildOptions,
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    // react-aria pulls in the CJS-only use-sync-external-store shim, whose
    // `require("react")` rolldown can only turn into a runtime `__require`
    // call that throws in ESM environments. React 19 (our peer-dependency
    // floor) ships useSyncExternalStore natively, so resolve the shim to
    // react itself instead.
    alias: {
        "use-sync-external-store/shim/index.js": "react",
    },
    plugins: [
        pluginSwcDecorators(),
        optimizeReactAriaLocales.rolldown({ locales: ["en-US"] }),
    ],
    deps: {
        // The package's runtime dependencies (d3, mobx, lodash-es, ...) are
        // meant to be part of the bundle, so opt out of tsdown's default of
        // externalizing everything listed in package.json.
        alwaysBundle: () => true,
        // ... which means we don't want to be warned about it either.
        onlyBundle: false,
    },
} satisfies UserConfig

// CSS options for the entry that owns a package's stylesheet.
export const packageCssOptions = (
    fileName: string
): NonNullable<UserConfig["css"]> => ({
    splitting: false,
    fileName,
    minify: true,
    preprocessorOptions: { scss: scssPreprocessorOptions },
})
