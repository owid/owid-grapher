import { execWrapper } from "../db/execWrapper.js"
import { dayjs } from "@ourworldindata/utils"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

/**
 * Retrieves information about the deployed commit on a live or staging server.
 * Usage examples:
 * - `yarn fetchServerStatus` will retrieve information about the currently deployed commit on https://ourworldindata.org and show it in a table
 * - `yarn fetchServerStatus new-feature-branch` will retrieve the commit that's current on http://staging-site-new-feature-branch
 *   (same as `yarn fetchServerStatus staging-site-new-feature-branch` or `yarn fetchServerStatus http://staging-site-new-feature-branch`)
 * - Other options are `--table`, `--show`, `--tree` to show the commit info in a table, `git show`, and `git log --graph`, respectively.
 *
 * Note:
 *  For the local git commands to work you need to have that commit on your machine. Run a `git fetch` if you're getting a git error message.
 */

interface CmdOptions {
    server: string
    tree: boolean
    table: boolean
    show: boolean
}

const runCommand = async (options: CmdOptions) => {
    const commitSha = await fetchCommitSha(options.server)

    if (options.table) {
        const commitInfo = await fetchGithubCommitInfo(commitSha)
        console.table({
            ...commitInfo,
            commitDate: dayjs(commitInfo.commitDate).fromNow(),
            commitUrl: `https://github.com/owid/owid-grapher/commit/${commitSha}`,
        })
    }

    if (options.tree) {
        await execWrapper(
            `git log -10 --graph --oneline --decorate --color=always ${commitSha}`
        )
    }

    if (options.show) {
        await execWrapper(`git show --stat --color=always ${commitSha}`)
    }
}

const getServerBaseUrl = (server: string) => {
    if (server.startsWith("http")) return server

    if (server.startsWith("staging-site-")) return `http://${server}`
    else return `http://staging-site-${server}`
}

const fetchCommitSha = async (server: string) => {
    const headUrl = `${getServerBaseUrl(server)}/head.txt`
    console.log("Fetching commit sha from", headUrl)
    return fetch(headUrl)
        .then((res) => {
            if (res.ok) return res
            throw Error(`Request rejected with status ${res.status}`)
        })
        .then((resp) => resp.text())
        .then((sha) => sha.trim())
}

const fetchGithubCommitInfo = async (
    commitSha: string
): Promise<ServerCommitInformation> =>
    await fetch(
        `https://api.github.com/repos/owid/owid-grapher/git/commits/${commitSha}`,
        {
            headers: {
                Accept: "application/vnd.github.v3",
            },
        }
    )
        .then((response) => response.json())
        .then((data) => ({
            commitSha: data.sha,
            commitDate: dayjs(data.author.date).toDate(),
            commitAuthor: data.author.name,
            commitMessage: data.message,
        }))

interface ServerCommitInformation {
    commitSha: string | undefined
    commitDate: Date | undefined
    commitAuthor: string | undefined
    commitMessage: string | undefined
}

void yargs(hideBin(process.argv))
    .command<CmdOptions>(
        "$0 [server]",
        "Fetch info about deployed commit from live or staging server",
        (yargs) => {
            yargs
                .positional("server", {
                    type: "string",
                    default: "https://ourworldindata.org",
                    describe: "Base URL of the site",
                })
                .option("table", {
                    type: "boolean",
                    default: true,
                    description: "Show info in a table",
                })
                .option("show", {
                    type: "boolean",
                    default: false,
                    description: "Show info in a 'git show''",
                })
                .option("tree", {
                    type: "boolean",
                    default: false,
                    description: "Show info in a 'git tree'",
                })
        },
        async (options) => {
            await runCommand(options)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
