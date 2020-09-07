import { keyBy, mapValues, sortBy } from "lodash"
import parseArgs from "minimist"
import fetch from "node-fetch"
import opener from "opener"
import * as timeago from "timeago.js"
import { exec } from "utils/server/serverUtil"

/**
 * Retrieves information about the deployed commit on a live or staging server.
 * Usage examples:
 * - `yarn live-commit` will retrieve information about the deployed commits for _all_ servers, and show a table
 * - `yarn live-commit live` will retrieve the commit that's live on https://ourworldindata.org and opens it in GitHub
 *   That's equivalent to `yarn live-commit live --open`
 * - `yarn live-commit staging --show` will `git show` information about the commit deployed on https://staging-owid.netlify.app
 * - `yarn live-commit --show --tree` will both show a git tree and a `git show` of the deployed commits on https://ourworldindata.org
 *
 * Note:
 *  For the local git commands to work you need to have that commit on your machine. Run a `git fetch` if you're getting a git error message.
 *  If it still doesn't work, the live commit is not pushed to GitHub yet. That should only happen on a staging server, never on live.
 */

const servers = [
    "live",
    "staging",
    "explorer",
    "exemplars",
    "hans",
    "playfair",
    "jefferson",
    "nightingale",
    "tufte",
    "roser",
]

const args = parseArgs(process.argv.slice(2))

const showTree = args["tree"]
const showCommit = args["show"]
const openInBrowser = args["open"] || !(showCommit || showTree)

function getServerUrl(server: string): string {
    if (server === "live") return "https://ourworldindata.org"
    else return `https://${server}-owid.netlify.com`
}

async function fetchCommitSha(server: string): Promise<string> {
    return fetch(`${getServerUrl(server)}/head.txt`)
        .then((res) => {
            if (res.ok) return res
            else throw Error(`Request rejected with status ${res.status}`)
        })
        .then((resp) => resp.text())
}

interface ServerCommitInformation {
    serverName: string
    commitSha: string | undefined
    commitDate: string | undefined
    commitAuthor: string | undefined
    commitMessage: string | undefined
}

async function fetchAll(): Promise<Array<ServerCommitInformation>> {
    const commits = await Promise.all(
        servers.map(async (serverName) => {
            let commitSha = undefined
            try {
                commitSha = await fetchCommitSha(serverName)
            } catch {
                commitSha = undefined
            }

            return {
                serverName,
                commitSha,
                commitDate: undefined,
                commitAuthor: undefined,
                commitMessage: undefined,
            }
        })
    )

    const commitsWithInformation = await Promise.all(
        commits.map(async (commit) => {
            if (!commit.commitSha) return commit

            const apiResponse = (await fetch(
                `https://api.github.com/repos/owid/owid-grapher/git/commits/${commit.commitSha}`,
                {
                    headers: {
                        Accept: "application/vnd.github.v3",
                    },
                }
            )) as any

            const response = await apiResponse.json()

            return {
                ...commit,
                commitSha: commit.commitSha.substr(0, 7),
                commitDate:
                    response?.author?.date && new Date(response?.author?.date),
                commitAuthor: response?.author?.name,
                commitMessage: response?.message?.split("\n")?.[0],
            }
        })
    )

    return sortBy(commitsWithInformation, (c) => c.commitDate ?? 0)
        .reverse()
        .map((commitInformation) => ({
            ...commitInformation,
            commitDate:
                commitInformation.commitDate &&
                timeago.format(commitInformation.commitDate),
        }))
}

if (args._[0]) {
    // fetch information for one specific server
    const server = args._[0]
    fetchCommitSha(server)
        .then(async (headSha) => {
            if (showTree)
                await exec(
                    `git log -10 --graph --oneline --decorate --color=always ${headSha}`
                )

            if (showTree && showCommit) console.log()

            if (showCommit)
                await exec(`git show --stat --color=always ${headSha}`)

            if (openInBrowser)
                opener(`https://github.com/owid/owid-grapher/commit/${headSha}`)
        })
        .catch((err) =>
            console.error(
                `Could not retrieve commit information from ${getServerUrl(
                    server
                )}. ${err}`
            )
        )
} else {
    // fetch information for _all_ servers
    fetchAll().then((commitInformation) => {
        const data = mapValues(
            keyBy(
                commitInformation,
                (commitInformation) => commitInformation.serverName
            ),
            (commitInformation) => {
                const {
                    commitSha,
                    commitDate,
                    commitAuthor,
                    commitMessage,
                } = commitInformation

                return {
                    commitSha,
                    commitDate,
                    commitAuthor,
                    commitMessage:
                        // truncate to 50 characters
                        commitMessage && commitMessage.length > 50
                            ? commitMessage?.substr(0, 50) + "…"
                            : commitMessage,
                }
            }
        )

        console.table(data)
    })
}
