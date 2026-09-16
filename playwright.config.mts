import { defineConfig, devices } from "@playwright/test"
import { BAKED_BASE_URL, ENV } from "./settings/clientSettings.mts"

const wikipediaArchiveDir =
    ENV === "development"
        ? "wikipedia-archive"
        : "/home/owid/live-data/wikipedia-archive"

export default defineConfig({
    testDir: "./playwright",
    testIgnore: "admin.test.ts",
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
    ],
})
