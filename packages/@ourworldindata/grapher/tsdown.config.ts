import { defineConfig, type UserConfig } from "tsdown"
// The build config is reaching outside of the package, which is okay here.
import {
    BUILD_TARGET,
    pluginOptimizeReactAriaLocales,
    pluginSwcDecorators,
    scssPreprocessorOptions,
    // oxlint-disable-next-line import-x-js/no-relative-packages
} from "../../../rolldown.config-common.mts"

// Builds the standalone @ourworldindata/grapher npm package / CDN bundle.
// See readme.md ("Build outputs") and https://docs.owid.io/projects/grapher/
// for what the outputs are and how they're meant to be consumed.
//
// There are three entries, which tsdown builds concurrently in one run:
//
//   npm         dist/grapher.js + dist/grapher.css   for bundler/React consumers
//   standalone  dist/grapher.standalone.min.js       for plain HTML pages
//   types       dist/grapher.d.ts                    for both of the above
//
// They all write into dist/, so no two of them may emit the same filename.

const REACT_EXTERNALS = [/^react($|\/)/, /^react-dom($|\/)/]

// Options that apply to all three entries below.
const shared = {
    outDir: "./dist",
    platform: "browser",
    target: BUILD_TARGET,
    sourcemap: true,
    // Emit `.js` rather than `.mjs` - the package is "type": "module", so `.js`
    // is unambiguous.
    fixedExtension: false,
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
        pluginOptimizeReactAriaLocales({ locales: ["en-US"] }),
    ],
    deps: {
        // Grapher's runtime dependencies (d3, mobx, lodash-es, ...) are meant to
        // be part of the bundle, so opt out of tsdown's default of
        // externalizing everything listed in package.json.
        alwaysBundle: () => true,
        // ... which means we don't want to be warned about it either.
        onlyBundle: false,
    },
    // Types are built separately, from the CSS-free `grapher.public.ts` entry.
    dts: false,
} satisfies UserConfig

export default defineConfig([
    // The ES module build, published as the package's `main`. Meant for React
    // apps and bundler environments, so it's left unminified and React stays
    // external. This is also the entry that owns the stylesheet: it's the only
    // one built from grapher.entry.ts, which imports grapher.scss.
    {
        ...shared,
        name: "npm",
        entry: { grapher: "./src/grapher.entry.ts" },
        // React is a peer dependency of the npm package.
        deps: { ...shared.deps, neverBundle: REACT_EXTERNALS },
        css: {
            splitting: false,
            fileName: "grapher.css",
            minify: true,
            preprocessorOptions: { scss: scssPreprocessorOptions },
        },
    },
    // The standalone bundle for the package's `./standalone` export: minified,
    // with React bundled in, so it can be dropped into a plain HTML page via a
    // single `import`. Built from a CSS-free entry, since the npm build above
    // already emits dist/grapher.css - which is where CDN consumers load the
    // styles from too.
    {
        ...shared,
        name: "standalone",
        entry: {
            "grapher.standalone.min": "./src/grapher.standalone.entry.ts",
        },
        minify: true,
    },
    // The bundled type declarations for the public API, shared by both builds
    // above. Emits no JS of its own (`emitDtsOnly`), and uses the CSS- and
    // polyfill-free grapher.public.ts entry - the declaration pass runs through
    // tsgo, which has no idea what to do with an `import "./core/grapher.scss"`.
    {
        ...shared,
        name: "types",
        entry: { grapher: "./src/grapher.public.ts" },
        // Includes the sources of grapher's workspace dependencies so their
        // types can be inlined into the bundle.
        tsconfig: "../tsconfig.tsdown.json",
        deps: {
            // Types from our own workspace packages (@ourworldindata/*) are
            // inlined into the bundle, all other imports stay external.
            alwaysBundle: [/^@ourworldindata\//],
            // The workspace packages we inline have their own dependencies
            // (dayjs, zod, ...) that aren't in grapher's package.json, so tsdown
            // wouldn't auto-externalize them. Everything that's not a relative
            // import or a workspace package must stay external.
            neverBundle: (id: string) =>
                !id.startsWith(".") &&
                !id.startsWith("/") &&
                !id.startsWith("@ourworldindata/"),
        },
        // Drop side-effect-only imports (`import "dayjs"`) of external modules
        // from the bundle — consumers may not have those packages installed.
        treeshake: { moduleSideEffects: false },
        dts: { emitDtsOnly: true },
    },
])
