// For now:
// - server tests end in .node.test.tsx? and are run in the node environment
// - client tests end in .test.tsx? and are run in the jsdom environment
//
// This may not be ideal long-term, but we need a simple pattern-matching way to distinguish
// between client and server tests. -@jasoncrawford 2019-12-03

const common = {
    moduleNameMapper: {
        "^(adminSite|site|grapher|gitCms|explorer|coreTable|clientUtils|serverUtils|db|deploy)/(.*)$":
            "<rootDir>/$1/compiled/$2",
        "^settings$": "<rootDir>/settings",
        "^serverSettings$": "<rootDir>/serverSettings",
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
        // {
        //     ...common,
        //     displayName: "jsdom",
        //     testEnvironment: "jsdom",
        //     setupFilesAfterEnv: ["<rootDir>/.enzymeSetup.ts"],
        //     testMatch: ["**/*.jsdom.test.(jsx|js)"],
        // },
    ],
}
