export default {
    testTimeout: 1000,
    transform: {},
    projects: [
        {
            displayName: { name: "node", color: "magenta" },
            testEnvironment: "node",
            testPathIgnorePatterns: [".jsdom.test."],
            testMatch: ["**/*.test.(jsx|js)"],
        },
        {
            displayName: { name: "jsdom", color: "cyan" },
            testEnvironment: "jsdom",
            testMatch: ["**/*.jsdom.test.(jsx|js)"],
        },
    ],
}
