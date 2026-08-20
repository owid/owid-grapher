import { defineConfig } from "vitest/config"

// Config for the built-package smoke tests in packageTest/. These tests need
// dist/ and the packed dist-package/grapher.tgz to exist (run `yarn build` and
// `yarn testPackage:pack` first) and are therefore kept out of the regular
// unit test run: the `.packagetest.ts` suffix doesn't match vitest's default
// include pattern, and only this config picks them up.
// Run with `yarn testPackage:vitest` (or `yarn testPackage`, which also packs
// and runs the standalone attw check).
export default defineConfig({
    test: {
        include: ["packageTest/**/*.packagetest.ts"],
        // Packing + typechecking the package takes a while.
        testTimeout: 180_000,
        hookTimeout: 180_000,
    },
})
