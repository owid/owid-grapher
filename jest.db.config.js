export default {
    testTimeout: 10000,
    projects: [
        {
            displayName: { name: "db", color: "blue" },
            testEnvironment: "node",
            transform: {},
            testMatch: ["<rootDir>/itsJustJavascript/db/tests/**/*.test.js"],
            modulePathIgnorePatterns: ["<rootDir>/wordpress/"],
        },
    ],
}
