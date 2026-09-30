import { defineConfig } from "vitest/config"
// oxlint-disable-next-line import-x-js/no-relative-packages
import { packageTestConfig } from "../packageTest-common.mts"

// Config for the built-package smoke tests in packageTest/. Run with
// `yarn testPackage:vitest` (or `yarn testPackage`, which also packs and runs
// the attw check).
export default defineConfig(packageTestConfig)
