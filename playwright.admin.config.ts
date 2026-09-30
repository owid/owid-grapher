import { defineConfig, devices } from "@playwright/test"
import { ADMIN_SERVER_PORT, testServerEnv } from "./playwright/admin/ports.js"

export default defineConfig({
    testDir: "./playwright/admin",
    testMatch: "**/*.test.ts",
    // per port, so that suites running side by side don't clear each other's
    outputDir: `test-results/admin-${ADMIN_SERVER_PORT}`,
    fullyParallel: true,
    timeout: 60_000,
    reporter: [["line"]],
    use: {
        baseURL: `http://localhost:${ADMIN_SERVER_PORT}`,
        trace: "retain-on-failure",
    },
    webServer: {
        command:
            "./db/tests/run-db-tests.sh yarn tsx --tsconfig tsconfig.tsx.json playwright/admin/server.ts",
        env: { DBTEST_APP_ENV: "development", ...testServerEnv },
        port: ADMIN_SERVER_PORT,
        reuseExistingServer: false,
        timeout: 120_000,
    },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                channel: "chromium",
                launchOptions: {
                    // lets sandboxes with a preinstalled Chromium skip the
                    // browser download
                    executablePath:
                        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
                        undefined,
                },
            },
        },
    ],
})
