import { defineConfig } from "vitest/config"

// Config for the built-package smoke tests in packageTest/. These tests need
// dist/ to exist (run `yarn build` first) and are therefore kept out of the
// regular unit test run: the `.packagetest.ts` suffix doesn't match vitest's
// default include pattern, and only this config picks them up.
// Run with `yarn testPackage`.
export default defineConfig({
    test: {
        include: ["packageTest/**/*.packagetest.ts"],
        // Packing + typechecking the package takes a while.
        testTimeout: 180_000,
        hookTimeout: 180_000,
    },
})
