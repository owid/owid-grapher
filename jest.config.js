// Build the project JS first, and then test the JS. that should be the default, since it is always faster.
// todo: restore the other slow option as a secondary option—passing a ts file to jest directly
const common = {
    moduleNameMapper: {
        "^(site|grapher|gitCms|explorer|coreTable|gridLang|clientUtils|adminSiteServer|db|deploy|settings)/(.*)$":
            "<rootDir>/$1/compiled/$2",
    },
}

module.exports = {
    testTimeout: 1000,
    projects: [
        {
            ...common,
            displayName: "node",
            testEnvironment: "node",
            testPathIgnorePatterns: [".jsdom.test."],
            testMatch: ["**/*.test.(jsx|js)"],
        },
        {
            ...common,
            displayName: "jsdom",
            testEnvironment: "jsdom",
            testMatch: ["**/*.jsdom.test.(jsx|js)"],
        },
    ],
}
