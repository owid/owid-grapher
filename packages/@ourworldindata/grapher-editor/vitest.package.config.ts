import { defineConfig } from "vitest/config"

// Config for the built-package smoke tests in packageTest/. They need dist/
// and the packed dist-package/grapher-editor.tgz to exist (`yarn build`, then
// `yarn testPackage:pack`), so they are kept out of the regular unit test run:
// the `.packagetest.ts` suffix doesn't match vitest's default include, and
// only this config picks them up. Run with `yarn testPackage`.
export default defineConfig({
    test: {
        include: ["packageTest/**/*.packagetest.ts"],
        testTimeout: 180_000,
        hookTimeout: 180_000,
    },
})
