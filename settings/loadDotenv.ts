import dotenv from "dotenv"
import findBaseDir from "./findBaseDir.js"

if (typeof __dirname !== "undefined") {
    // only run this code in node, not in the browser.
    // in the browser, process.env is already populated by vite.
    const baseDir = findBaseDir(__dirname)
    if (baseDir) dotenv.config({ path: `${baseDir}/.env` })
}
