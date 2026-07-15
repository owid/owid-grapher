import { defineConfig } from "tsdown"

// Generates the bundled type declarations for the npm package
// (dist/grapher.public.d.ts). The JS is built by vite (see vite.config.mts);
// tsdown only emits types. Types from our own workspace packages
// (@ourworldindata/*) are inlined into the bundle, all other imports stay
// external.
export default defineConfig({
    entry: { "grapher.public": "./src/grapher.public.ts" },
    outDir: "./dist",
    // Don't wipe dist — it already contains the vite JS build output
    clean: false,
    tsconfig: "./tsconfig.tsdown.json",
    deps: {
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
    // Emit dist/grapher.public.d.ts rather than .d.mts — the package is
    // "type": "module", so .d.ts is unambiguous.
    fixedExtension: false,
    dts: {
        emitDtsOnly: true,
    },
})
