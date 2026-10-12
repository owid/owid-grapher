// tsdown options shared by the builds of our published npm packages
// (<package>/tsdown.config.ts).
import type { UserConfig } from "tsdown"
import { BUILD_TARGET } from "../../rolldown.config-common.mts"

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
