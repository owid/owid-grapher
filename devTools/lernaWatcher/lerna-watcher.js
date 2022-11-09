/**
 * Each package has its own watch script, but running them via `lerna run watch` doesn't work because it gets stuck on the first process.
 * `lerna run watch --parallel` is meant to be the solution to this, but it's not ideal because it swallows stdout,
 * so if you introduce a TypeScript error, there's no way of knowing that the build is failing.
 * This script watches each packages/@ourworldindata/___/src/ directory and runs `lerna run build` each time there's a change
 * Because of nx caching, this is usually fast, and we get stdout when there's TS errors.
 *
 * Hopefully lerna will add the ability to pipe stdout in parallel mode soon :~)
 */
const chokidar = require("chokidar")
const path = require("path")
const { execSync } = require("child_process")

console.log("watching packages/@ourworldindata")

function execLernaBuild() {
    try {
        execSync("yarn lerna run build", { stdio: "inherit" })
    } catch (e) {
        console.log(e)
    }
}

chokidar
    .watch(path.join(__dirname, "../../packages/@ourworldindata/*/src/**"), {
        persistent: true,
    })
    .on("change", execLernaBuild)
