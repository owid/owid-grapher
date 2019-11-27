module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        "^(admin|site|charts|utils|db|settings)/(.*)$": "<rootDir>/$1/$2",
        "^settings$": "<rootDir>/settings",
        "^serverSettings$": "<rootDir>/serverSettings"
    },
    setupFilesAfterEnv: ['<rootDir>/test/enzymeSetup.ts']
}
