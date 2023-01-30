module.exports = {
    testTimeout: 10000,
    projects: [
        {
            displayName: { name: "db", color: "blue" },
            testEnvironment: "node",
            testMatch: ["<rootDir>/itsJustJavascript/db/tests/**/*.test.js"],
            modulePathIgnorePatterns: ["<rootDir>/wordpress/"],
        },
    ],
}

// special envs for tests
process.env = Object.assign(process.env, {
    CATALOG_PATH: "https://owid-catalog.nyc3.digitaloceanspaces.com",
})
