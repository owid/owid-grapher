import { defineConfig, devices } from "@playwright/test"
import { defineBddConfig } from "playwright-bdd"
import { BAKED_BASE_URL, ENV } from "./settings/clientSettings.ts"

const testDir = defineBddConfig({
    features: "features/**/*.feature",
    steps: "features/**/*.steps.ts",
    aiFix: {
        promptAttachment: true,
    },
})

const wikipediaArchiveDir =
    ENV === "development"
        ? "wikipedia-archive"
        : "/home/owid/live-data/wikipedia-archive"

export default defineConfig({
    testDir,
    reporter: ENV === "development" ? [["line"]] : [["dot"]],
    use: {
        baseURL: `${BAKED_BASE_URL}${ENV !== "development" ? ".tail6e23.ts.net" : ""}`,
    },
    webServer: [
        {
            command: `http-server ${wikipediaArchiveDir} -p 8765 -c-1 --silent`,
            port: 8765,
            reuseExistingServer: true,
        },
    ],
    projects: [
        {
            name: "chromium",
            // use chromium new headless mode https://playwright.dev/docs/browsers#chromium-new-headless-mode
            use: { ...devices["Desktop Chrome"], channel: "chromium" },
        },
        {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
        },
        {
            name: "webkit",
            use: { ...devices["Desktop Safari"] },
        },
    ],
})
