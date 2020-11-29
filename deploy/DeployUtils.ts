import fs from "fs-extra"
import { SiteBaker } from "baker/SiteBaker"
import { log } from "adminSiteServer/log"
import {
    queueIsEmpty,
    readQueuedAndPendingFiles,
    clearQueueFile,
    deletePendingFile,
    writePendingFile,
    parseQueueContent,
} from "./queue"
import { DeployChange } from "./types"
import { BAKED_SITE_DIR } from "serverSettings"

async function defaultCommitMessage(): Promise<string> {
    let message = "Automated update"

    // In the deploy.sh script, we write the current git rev to 'public/head.txt'
    // and want to include it in the deploy commit message
    try {
        const sha = await fs.readFile("public/head.txt", "utf8")
        message += `\nowid/owid-grapher@${sha}`
    } catch (err) {
        log.warn(err)
    }

    return message
}

/**
 * Initiate a deploy, without any checks. Throws error on failure.
 */
async function bakeAndDeploy(message?: string, email?: string, name?: string) {
    message = message ?? (await defaultCommitMessage())

    const baker = new SiteBaker(BAKED_SITE_DIR)

    try {
        await baker.bakeAll()
        await baker.deployToNetlifyAndPushToGitPush(message, email, name)
    } catch (err) {
        log.error(err)
        throw err
    }
}

/**
 * Try to initiate a deploy and then terminate the baker, allowing a clean exit.
 * Used in CLI.
 */
export async function tryBakeDeployAndTerminate(
    message?: string,
    email?: string,
    name?: string
) {
    message = message ?? (await defaultCommitMessage())

    const baker = new SiteBaker(BAKED_SITE_DIR)

    try {
        await baker.bakeAll()
        await baker.deployToNetlifyAndPushToGitPush(message, email, name)
    } catch (err) {
        log.error(err)
    } finally {
        baker.endDbConnections()
    }
}

export async function tryBake() {
    const baker = new SiteBaker(BAKED_SITE_DIR)
    try {
        await baker.bakeAll()
    } catch (err) {
        log.error(err)
    } finally {
        baker.endDbConnections()
    }
}

/**
 * Try to initiate a deploy and then terminate the baker, allowing a clean exit.
 * Used in CLI.
 */
export async function tryDeploy(
    message?: string,
    email?: string,
    name?: string
) {
    message = message ?? (await defaultCommitMessage())
    const baker = new SiteBaker(BAKED_SITE_DIR)

    try {
        await baker.deployToNetlifyAndPushToGitPush(message, email, name)
    } catch (err) {
        log.error(err)
    } finally {
        baker.endDbConnections()
    }
}

function generateCommitMsg(queueItems: DeployChange[]): string {
    const date: string = new Date().toISOString()

    const message: string = queueItems
        .filter((item) => item.message)
        .map((item) => item.message)
        .join("\n")

    const coauthors: string = queueItems
        .filter((item) => item.authorName)
        .map((item) => {
            return `Co-authored-by: ${item.authorName} <${item.authorEmail}>`
        })
        .join("\n")

    return `Deploy ${date}\n${message}\n\n\n${coauthors}`
}

const MAX_SUCCESSIVE_FAILURES = 2

/** Whether a deploy is currently running */
let deploying: boolean = false

/**
 * Initiate deploy if no other deploy is currently pending, and there are changes
 * in the queue.
 * If there is a deploy pending, another one will be automatically triggered at
 * the end of the current one, as long as there are changes in the queue.
 * If there are no changes in the queue, a deploy won't be initiated.
 */
export async function deployIfQueueIsNotEmpty() {
    if (deploying) return
    deploying = true
    let failures = 0
    while (!(await queueIsEmpty()) && failures < MAX_SUCCESSIVE_FAILURES) {
        const deployContent = await readQueuedAndPendingFiles()
        // Truncate file immediately. Ideally this would be an atomic action, otherwise it's
        // possible that another process writes to this file in the meantime...
        await clearQueueFile()
        // Write to `.deploying` file to be able to recover the deploy message
        // in case of failure.
        await writePendingFile(deployContent)
        const message = generateCommitMsg(parseQueueContent(deployContent))
        console.log(`Deploying site...\n---\n${message}\n---`)
        try {
            await bakeAndDeploy(message)
            await deletePendingFile()
        } catch (err) {
            failures++
            // The error is already sent to Slack inside the deploy() function.
            // The deploy will be retried unless we've reached MAX_SUCCESSIVE_FAILURES.
        }
    }
    deploying = false
}
