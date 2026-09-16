import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
    testDir: "./playwright",
    testMatch: "**/admin.test.ts",
    timeout: 60_000,
    reporter: [["line"]],
    use: {
        baseURL: "http://localhost:8765/admin",
    },
    webServer: {
        command:
            "DBTEST_APP_ENV=development ./db/tests/run-db-tests.sh env VITE_PORT=8766 yarn tsx --tsconfig tsconfig.tsx.json playwright/admin-test-server.ts",
        port: 8765,
        reuseExistingServer: false,
        timeout: 120_000,
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"], channel: "chromium" },
        },
    ],
})
