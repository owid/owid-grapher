import jest from "jest"
import config from "./jest.config.js"

// find ./tests -type f \( -name \*.test.ts -o -name \*.test.tsx \) | sort -R | xargs -L 5 -P 4 jest --runInBand --logHeapUsage

// Running tests separately to avoid memory leak crash on the GitHub Actions process
jest.runCLI(
    {
        testTimeout: 1000,
        transform: {},
        projects: [
            {
                displayName: { name: "node", color: "magenta" },
                testEnvironment: "node",
                testPathIgnorePatterns: [".jsdom.test."],
                testMatch: ["**/*.test.(jsx|js)"],
            },
        ],
    },
    [process.cwd()]
)
    .then(() =>
        jest.runCLI(
            {
                testTimeout: 1000,
                transform: {},
                projects: [
                    {
                        displayName: { name: "jsdom", color: "cyan" },
                        testEnvironment: "jsdom",
                        testMatch: ["**/*.jsdom.test.(jsx|js)"],
                    },
                ],
            },
            [process.cwd()]
        )
    )
    .catch((error) => {
        console.error(error)
    })
