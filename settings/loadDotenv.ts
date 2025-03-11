import dotenv from "dotenv"
import findBaseDir from "./findBaseDir.js"

if (typeof __dirname !== "undefined") {
    // only run this code in node, not in the browser.
    // in the browser, process.env is already populated by vite.
    const baseDir = findBaseDir(__dirname)
    if (!baseDir) throw new Error("could not locate base package.json")

    // If a ENV_FILE is specified, load its variables first, and then load the default .env file
    const additionalEnvFile = process.env.ENV_FILE || undefined
    let dotenvPath: string[]
    if (additionalEnvFile) {
        dotenvPath = [`${baseDir}/${additionalEnvFile}`, `${baseDir}/.env`]
    } else {
        dotenvPath = [`${baseDir}/.env`]
    }
    dotenv.config({ path: dotenvPath })
}
