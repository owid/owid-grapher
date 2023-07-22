export default {
    testTimeout: 1000,
    projects: [
        {
            displayName: { name: "node", color: "magenta" },
            testEnvironment: "node",
            transform: {},
            testPathIgnorePatterns: [
                ".jsdom.test.",
                "<rootDir>/itsJustJavascript/db/tests",
            ],
            testMatch: ["**/*.test.(jsx|js)"],
            modulePathIgnorePatterns: ["<rootDir>/wordpress/"],
        },
        {
            displayName: { name: "jsdom", color: "cyan" },
            testEnvironment: "jsdom",
            transform: {},
            testMatch: ["**/*.jsdom.test.(jsx|js)"],
            // modulePathIgnorePatterns: ["<rootDir>/wordpress/"],
        },
    ],
}

// special envs for tests
process.env = Object.assign(process.env, {
    CATALOG_PATH: "https://owid-catalog.nyc3.digitaloceanspaces.com",
    WORDPRESS_URL: "http://localhost:8080",
    BAKED_BASE_URL: "http://localhost:3030",
})
