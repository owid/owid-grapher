module.exports = {
    testTimeout: 1000,
    projects: [
        {
            displayName: { name: "node", color: "magenta" },
            testEnvironment: "node",
            testPathIgnorePatterns: [
                ".jsdom.test.",
                "<rootDir>/itsJustJavascript/db/tests",
            ],
            testMatch: ["**/*.test.(jsx|js)"],
        },
        {
            displayName: { name: "jsdom", color: "cyan" },
            testEnvironment: "jsdom",
            testMatch: ["**/*.jsdom.test.(jsx|js)"],
        },
    ],
}

// special envs for tests
process.env = Object.assign(process.env, {
    CATALOG_PATH: "https://owid-catalog.nyc3.digitaloceanspaces.com",
    BAKED_BASE_URL: "http://localhost:3030",
})
