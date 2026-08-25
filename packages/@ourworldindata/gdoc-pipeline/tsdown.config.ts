import { defineConfig, type UserConfig } from "tsdown"
// The build config is reaching outside of the package, which is okay here.
import {
    BUILD_TARGET,
    pluginSwcDecorators,
    // oxlint-disable-next-line import-x-js/no-relative-packages
} from "../../../rolldown.config-common.mts"

// Builds the @ourworldindata/gdoc-pipeline npm package. See readme.md for how
// the outputs are meant to be consumed.
//
// There are two entries, which tsdown builds concurrently in one run:
//
//   npm     dist/gdoc-pipeline.js     the bundled ES module
//   types   dist/gdoc-pipeline.d.ts   its type declarations
//
// They both write into dist/, so the two of them may not emit the same
// filename.

// Options that apply to both entries below.
const shared = {
    entry: { "gdoc-pipeline": "./src/index.ts" },
    outDir: "./dist",
    // The pipeline is isomorphic: it runs in browsers (e.g. Chrome
    // extensions) as well as Node. "browser" is the stricter platform — it
    // makes the build fail if a node builtin ever sneaks back in.
    platform: "browser",
    target: BUILD_TARGET,
    sourcemap: true,
    // Emit `.js` rather than `.mjs` - the package is "type": "module", so `.js`
    // is unambiguous.
    fixedExtension: false,
    // The workspace packages that get bundled (see below) contain MobX
    // decorator syntax in some of their modules; the plugin keeps rolldown
    // able to transform whatever of that survives treeshaking.
    plugins: [pluginSwcDecorators()],
    // Types are built separately from the same entry.
    dts: false,
} satisfies UserConfig

export default defineConfig([
    // The ES module build, published as the package's `main`. All runtime
    // dependencies (archieml, cheerio, lodash-es, ...) and the
    // @ourworldindata workspace packages are bundled in, so the published
    // package has no runtime dependencies at all.
    {
        ...shared,
        name: "npm",
        deps: {
            alwaysBundle: () => true,
            // ... which means we don't want to be warned about it either.
            onlyBundle: false,
            // None of these belong in a parsing library. The pipeline doesn't
            // use them, but the workspace packages it bundles (utils,
            // components) import them in unrelated modules — treeshaking is
            // supposed to drop all of that. Keeping them external turns a
            // treeshaking failure into a visible `import` in the output,
            // which the package test rejects (the bundle must be
            // self-contained), instead of silently inlining e.g. React.
            neverBundle: [
                /^react($|\/)/,
                /^react-dom($|\/)/,
                /^mobx($|\/)/,
                /^@sentry\//,
            ],
        },
        // The bundled workspace packages are imported through their index
        // barrels, which reach many modules the pipeline doesn't use — some
        // with top-level side effects (React component modules, DOM access,
        // ...). Treat all modules as side-effect-free so everything
        // unreferenced is dropped; the pipeline itself relies on no
        // module-evaluation side effects, and the package test runs the
        // built bundle end-to-end to prove nothing needed was lost.
        treeshake: { moduleSideEffects: false },
    },
    // The bundled type declarations. Emits no JS of its own (`emitDtsOnly`).
    {
        ...shared,
        name: "types",
        // Includes the sources of this package's workspace dependencies so
        // their types can be inlined into the bundle.
        tsconfig: "../tsconfig.tsdown.json",
        deps: {
            // Types from our own workspace packages (@ourworldindata/*) are
            // inlined into the bundle, all other imports stay external.
            alwaysBundle: [/^@ourworldindata\//],
            // The workspace packages we inline have their own dependencies
            // (dayjs, zod, ...) that aren't in this package.json, so tsdown
            // wouldn't auto-externalize them. Everything that's not a relative
            // import or a workspace package must stay external.
            neverBundle: (id: string) =>
                !id.startsWith(".") &&
                !id.startsWith("/") &&
                !id.startsWith("@ourworldindata/"),
        },
        // Drop side-effect-only imports of external modules from the bundle —
        // consumers may not have those packages installed.
        treeshake: { moduleSideEffects: false },
        dts: { emitDtsOnly: true },
    },
])
