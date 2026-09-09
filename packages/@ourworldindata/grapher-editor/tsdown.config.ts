import { defineConfig, type UserConfig } from "tsdown"
import optimizeReactAriaLocales from "@react-aria/optimize-locales-plugin"
// The build config is reaching outside of the package, which is okay here.
import {
    BUILD_TARGET,
    pluginSwcDecorators,
    scssPreprocessorOptions,
    // oxlint-disable-next-line import-x-js/no-relative-packages
} from "../../../rolldown.config-common.mts"

// Builds the @ourworldindata/grapher-editor npm package / CDN bundle. Mirrors
// ../grapher/tsdown.config.ts; see readme.md ("Build outputs").
//
//   npm         dist/editor.react.js + dist/editor.css     for React apps and bundlers
//   standalone  dist/editor.standalone.min.js              for plain HTML pages
//   types       dist/editor.d.ts                           for both of the above
//
// The editor's sources live in adminSiteClient/ (see src/index.ts); the
// bundle pulls them in through relative imports.

const REACT_EXTERNALS = [/^react($|\/)/, /^react-dom($|\/)/]

const shared = {
    outDir: "./dist",
    platform: "browser",
    target: BUILD_TARGET,
    sourcemap: true,
    fixedExtension: false,
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    // See ../grapher/tsdown.config.ts for why.
    alias: {
        "use-sync-external-store/shim/index.js": "react",
    },
    plugins: [
        pluginSwcDecorators(),
        optimizeReactAriaLocales.rolldown({ locales: ["en-US"] }),
    ],
    deps: {
        alwaysBundle: () => true,
        onlyBundle: false,
    },
    dts: false,
} satisfies UserConfig

export default defineConfig([
    // The ES module build, published as `./react`: React stays external, and
    // this entry owns the stylesheet.
    {
        ...shared,
        name: "npm",
        entry: { "editor.react": "./src/editor.entry.ts" },
        deps: { ...shared.deps, neverBundle: REACT_EXTERNALS },
        css: {
            splitting: false,
            fileName: "editor.css",
            minify: true,
            preprocessorOptions: { scss: scssPreprocessorOptions },
        },
    },
    // The standalone bundle, published as the root export: minified, React
    // and grapher bundled in, CSS-free (load dist/editor.css alongside).
    {
        ...shared,
        name: "standalone",
        entry: {
            "editor.standalone.min": "./src/editor.standalone.entry.ts",
        },
        minify: true,
    },
    // Bundled type declarations for both builds. Uses a tsconfig at the repo
    // root because the sources span packages/ and adminSiteClient/.
    {
        ...shared,
        name: "types",
        entry: { editor: "./src/index.ts" },
        tsconfig: "../../../tsconfig.editor-dts.json",
        deps: {
            alwaysBundle: [/^@ourworldindata\//],
            neverBundle: (id: string) =>
                !id.startsWith(".") &&
                !id.startsWith("/") &&
                !id.startsWith("@ourworldindata/"),
        },
        treeshake: { moduleSideEffects: false },
        dts: { emitDtsOnly: true },
    },
])
