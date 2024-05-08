module.exports = {
    testTimeout: 10000,
    projects: [
        {
            displayName: { name: "db", color: "blue" },
            testEnvironment: "node",
            testMatch: ["<rootDir>/itsJustJavascript/db/tests/**/*.test.js"],
        },
    ],
}
