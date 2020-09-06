// We need to keep this until we make the EXPLORER flag obsolete (by enabling
// the explorer on the live site)
process.env.EXPLORER = true

// For now:
// - server tests end in .node.test.tsx? and are run in the node environment
// - client tests end in .test.tsx? and are run in the jsdom environment
//
// This may not be ideal long-term, but we need a simple pattern-matching way to distinguish
// between client and server tests. -@jasoncrawford 2019-12-03

const common = {
    preset: "ts-jest",
    moduleNameMapper: {
        "^(adminSite|site|grapher|explorer|owidTable|utils|db|settings|test)/(.*)$":
            "<rootDir>/$1/$2",
        "^settings$": "<rootDir>/settings",
        "^serverSettings$": "<rootDir>/serverSettings",
        // Jest cannot handle importing CSS
        // https://stackoverflow.com/questions/39418555/syntaxerror-with-jest-and-react-and-importing-css-files
        "\\.(css|less|sass|scss)$": "<rootDir>/utils/styleMock.ts"
    }
}

module.exports = {
    projects: [
        {
            ...common,
            displayName: "node",
            testEnvironment: "node",
            testPathIgnorePatterns: [".jsdom.test."],
            testMatch: ["**/*.test.(tsx|ts)"]
        },
        {
            ...common,
            displayName: "jsdom",
            testEnvironment: "jsdom",
            setupFilesAfterEnv: ["<rootDir>/.enzymeSetup.ts"],
            testMatch: ["**/*.jsdom.test.(tsx|ts)"]
        }
    ]
}
