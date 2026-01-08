import { defineConfig } from "@playwright/test"
import { defineBddConfig } from "playwright-bdd"

const testDir = defineBddConfig({
    features: "features/**/*.feature",
    steps: "features/**/*.steps.ts",
    aiFix: {
        promptAttachment: true,
    },
})

export default defineConfig({
    testDir,
    reporter: "html",
})
