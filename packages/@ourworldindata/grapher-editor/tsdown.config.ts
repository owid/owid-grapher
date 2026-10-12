import { defineConfig, type UserConfig } from "tsdown"
// The build config is reaching outside of the package, which is okay here.
import {
    dtsBundleOptions,
    packageCssOptions,
    REACT_EXTERNALS,
    reactPackageBuildOptions,
    // oxlint-disable-next-line import-x-js/no-relative-packages
} from "../tsdown.config-common.mts"

// Builds the @ourworldindata/grapher-editor npm package / CDN bundle, the same
// way ../grapher/tsdown.config.ts builds grapher's; see readme.md ("Build
// outputs").
//
//   npm         dist/editor.react.js + dist/editor.css   for React apps and bundlers
//   standalone  dist/editor.standalone.min.js            for plain HTML pages
//   types       dist/editor.d.ts                         for both of the above
//
// The editor's sources live in adminSiteClient/; the bundle pulls them in
// through the relative imports in src/editor.public.ts.

const shared = {
    ...reactPackageBuildOptions,
    // One file per build: the Debug tab's diff viewer lazy-loads a syntax
    // grammar per language, which would otherwise become ~30 extra chunks
    // the package's `files` don't ship.
    outputOptions: { codeSplitting: false },
} satisfies UserConfig

export default defineConfig([
    // The ES module build, published as `./react`: React stays external, and
    // this entry owns the stylesheet.
    {
        ...shared,
        name: "npm",
        entry: { "editor.react": "./src/editor.entry.ts" },
        deps: { ...shared.deps, neverBundle: REACT_EXTERNALS },
        css: packageCssOptions("editor.css"),
    },
    // The standalone bundle, published as the root export: minified, with
    // React bundled in, and CSS-free (load dist/editor.css alongside).
    {
        ...shared,
        name: "standalone",
        entry: {
            "editor.standalone.min": "./src/editor.standalone.entry.ts",
        },
        minify: true,
    },
    // The bundled type declarations for both builds. Its tsconfig sits at the
    // repo root because the sources span packages/ and adminSiteClient/.
    {
        ...shared,
        ...dtsBundleOptions,
        entry: { editor: "./src/editor.public.ts" },
        tsconfig: "../../../tsconfig.editor-dts.json",
    },
])
