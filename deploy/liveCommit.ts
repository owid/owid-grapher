import { keyBy, mapValues, sortBy, memoize } from "lodash"
import parseArgs from "minimist"
import fetch from "node-fetch"
import opener from "opener"
import * as timeago from "timeago.js"
import { exec } from "serverUtils/serverUtil"

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

const getServerUrl = (server: string) => {
    if (server === "live") return "https://ourworldindata.org"
    else return `https://${server}-owid.netlify.com`
}

const fetchCommitSha = async (server: string) =>
    fetch(`${getServerUrl(server)}/head.txt`)
        .then((res) => {
            if (res.ok) return res
            else throw Error(`Request rejected with status ${res.status}`)
        })
        .then(async (resp) => ({
            commitSha: await resp.text(),
        }))

interface ServerCommitInformation {
    serverName: string
    commitSha: string | undefined
    commitDate: Date | undefined
    commitAuthor: string | undefined
    commitMessage: string | undefined
}

const fetchAll = async () => {
    const commits = await Promise.all(
        servers.map(async (serverName) => {
            let commitInformation = undefined
            try {
                commitInformation = await fetchCommitSha(serverName)
            } catch {
                commitInformation = undefined
            }

            return {
                serverName,
                ...commitInformation,
                commitDate: undefined,
                commitAuthor: undefined,
                commitMessage: undefined,
            } as ServerCommitInformation
        })
    )

    const _fetchGithubCommitInfo = async (commitSha: string) =>
        await fetch(
            `https://api.github.com/repos/owid/owid-grapher/git/commits/${commitSha}`,
            {
                headers: {
                    Accept: "application/vnd.github.v3",
                },
            }
        ).then((response) => response.json())

    // Memoize so as to not fetch information about the same commit twice
    const fetchGithubCommitInfo = memoize(_fetchGithubCommitInfo)

    const commitsWithInformation = await Promise.all(
        commits.map(async (commit) => {
            if (!commit.commitSha) return commit

            const response = await fetchGithubCommitInfo(commit.commitSha)

            return {
                ...commit,
                commitSha: commit.commitSha.substr(0, 7),
                commitDate:
                    response?.author?.date && new Date(response.author.date),
                commitAuthor: response?.author?.name,
                commitMessage: response?.message?.split("\n")?.[0],
            } as ServerCommitInformation
        })
    )

    return sortBy(commitsWithInformation, (c) => c.commitDate ?? 0).reverse()
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
                    commitDate: commitDate && timeago.format(commitDate),
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
