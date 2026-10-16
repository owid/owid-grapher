import { defineConfig, type UserConfig } from "tsdown"
// The build config is reaching outside of the package, which is okay here.
import {
    dtsBundleOptions,
    packageCssOptions,
    REACT_EXTERNALS,
    reactPackageBuildOptions,
    // oxlint-disable-next-line import-x-js/no-relative-packages
} from "../tsdown.config-common.mts"

// Built like ../grapher/tsdown.config.ts; see readme.md ("Build outputs").

const shared = {
    ...reactPackageBuildOptions,
    // The Debug tab's diff viewer lazy-loads a grammar per language, which
    // would otherwise become ~30 chunks the package's `files` don't ship
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
