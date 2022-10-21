module.exports = {
    testTimeout: 1000,
    projects: [
        {
            displayName: { name: "node", color: "magenta" },
            testEnvironment: "node",
            testPathIgnorePatterns: [".jsdom.test."],
            testMatch: ["**/*.test.(jsx|js)"],
            modulePathIgnorePatterns: ["<rootDir>/wordpress/"],
        },
        {
            displayName: { name: "jsdom", color: "cyan" },
            testEnvironment: "jsdom",
            testMatch: ["**/*.jsdom.test.(jsx|js)"],
            // modulePathIgnorePatterns: ["<rootDir>/wordpress/"],
        },
    ],
}

// special envs for tests
process.env = Object.assign(process.env, {
    CATALOG_PATH: "https://owid-catalog.nyc3.digitaloceanspaces.com",
})
