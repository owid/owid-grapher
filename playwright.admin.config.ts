import { defineConfig, devices } from "@playwright/test"
import { ADMIN_SERVER_PORT, testServerEnv } from "./playwright/admin/ports.js"

export default defineConfig({
    testDir: "./playwright/admin",
    testMatch: "**/*.test.ts",
    fullyParallel: true,
    timeout: 60_000,
    reporter: [["line"]],
    use: {
        baseURL: `http://localhost:${ADMIN_SERVER_PORT}`,
        trace: "retain-on-failure",
    },
    webServer: {
        // The db test script sources .env, so the server's environment is
        // passed through `env` to take precedence over it
        command: [
            "DBTEST_APP_ENV=development ./db/tests/run-db-tests.sh env",
            ...Object.entries(testServerEnv).map(([k, v]) => `${k}=${v}`),
            "yarn tsx --tsconfig tsconfig.tsx.json playwright/admin/server.ts",
        ].join(" "),
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
