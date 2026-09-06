import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
    testDir: "./features/grapher",
    testMatch: "*.test.ts",
    fullyParallel: true,
    retries: 0,
    reporter: [
        ["list"],
        ["html", { outputFolder: "playwright-report/grapher", open: "never" }],
    ],
    use: {
        baseURL: "http://127.0.0.1:8791",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    webServer: {
        command:
            "yarn vite build --config features/grapher/vite.config.mts && yarn vite preview --config features/grapher/vite.config.mts",
        url: "http://127.0.0.1:8791",
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
