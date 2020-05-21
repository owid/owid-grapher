import parseArgs from "minimist"
import fetch from "node-fetch"
import opener from "opener"
import { promisifiedExec as exec } from "utils/server/serverUtil"

/**
 * Retrieves information about the deployed commit on a live or staging server.
 * Usage examples:
 * - `yarn live-commit` will retrieve the commit that's live on https://ourworldindata.org and opens it in GitHub
 *   That's equivalent to `yarn live-commit live --open`
 * - `yarn live-commit staging --show` will `git show` information about the commit deployed on https://staging-owid.netlify.app
 * - `yarn live-commit --show --tree` will both show a git tree and a `git show` of the deployed commits on https://ourworldindata.org
 *
 * Note:
 *  For the local git commands to work you need to have that commit on your machine. Run a `git fetch` if you're getting a git error message.
 *  If it still doesn't work, the live commit is not pushed to GitHub yet. That should only happen on a staging server, never on live.
 */

const args = parseArgs(process.argv.slice(2))

const showTree = args["tree"]
const showCommit = args["show"]
const openInBrowser = args["open"] || !(showCommit || showTree)

let server = "https://ourworldindata.org"
if (args._[0] && args._[0] !== "live") {
    server = `https://${args._[0]}-owid.netlify.com`
}

fetch(`${server}/head.txt`)
    .then(res => {
        if (res.ok) return res
        else throw Error(`Request rejected with status ${res.status}`)
    })
    .then(resp => resp.text())
    .then(async headSha => {
        if (showTree)
            await exec(
                `git log -10 --graph --oneline --decorate --color=always ${headSha}`
            )

        if (showTree && showCommit) console.log()

        if (showCommit) await exec(`git show --stat --color=always ${headSha}`)

        if (openInBrowser)
            opener(`https://github.com/owid/owid-grapher/commit/${headSha}`)
    })
    .catch(err =>
        console.error(
            `Could not retrieve live commit information from ${server}. ${err}`
        )
    )
