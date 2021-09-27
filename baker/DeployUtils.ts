import fs from "fs-extra"
import { SiteBaker } from "../baker/SiteBaker"
import { warn, logErrorAndMaybeSendToSlack } from "./slackLog"
import { DeployQueueServer } from "./DeployQueueServer"
import { BAKED_SITE_DIR, BAKED_BASE_URL } from "../settings/serverSettings"
import { DeployChange } from "../clientUtils/owidTypes"

const deployQueueServer = new DeployQueueServer()

const defaultCommitMessage = async (): Promise<string> => {
    let message = "Automated update"

    // In the deploy.sh script, we write the current git rev to 'public/head.txt'
    // and want to include it in the deploy commit message
    try {
        const sha = await fs.readFile("public/head.txt", "utf8")
        message += `\nowid/owid-grapher@${sha}`
    } catch (err) {
        warn(err)
    }

    return message
}

/**
 * Initiate a deploy, without any checks. Throws error on failure.
 */
const bakeAndDeploy = async (
    message?: string,
    email?: string,
    name?: string
) => {
    message = message ?? (await defaultCommitMessage())

    const baker = new SiteBaker(BAKED_SITE_DIR, BAKED_BASE_URL)

    try {
        await baker.bakeAll()
        await baker.deployToNetlifyAndPushToGitPush(message, email, name)
    } catch (err) {
        logErrorAndMaybeSendToSlack(err)
        throw err
    }
}

export const tryBake = async () => {
    const baker = new SiteBaker(BAKED_SITE_DIR, BAKED_BASE_URL)
    try {
        await baker.bakeAll()
    } catch (err) {
        logErrorAndMaybeSendToSlack(err)
    } finally {
        baker.endDbConnections()
    }
}

/**
 * Try to initiate a deploy and then terminate the baker, allowing a clean exit.
 * Used in CLI.
 */
export const tryDeploy = async (
    message?: string,
    email?: string,
    name?: string
) => {
    message = message ?? (await defaultCommitMessage())
    const baker = new SiteBaker(BAKED_SITE_DIR, BAKED_BASE_URL)

    try {
        await baker.deployToNetlifyAndPushToGitPush(message, email, name)
    } catch (err) {
        logErrorAndMaybeSendToSlack(err)
    } finally {
        baker.endDbConnections()
    }
}

const generateCommitMsg = (queueItems: DeployChange[]) => {
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
let deploying = false

/**
 * Initiate deploy if no other deploy is currently pending, and there are changes
 * in the queue.
 * If there is a deploy pending, another one will be automatically triggered at
 * the end of the current one, as long as there are changes in the queue.
 * If there are no changes in the queue, a deploy won't be initiated.
 */
export const deployIfQueueIsNotEmpty = async () => {
    if (deploying) return
    deploying = true
    let failures = 0
    while (
        !(await deployQueueServer.queueIsEmpty()) &&
        failures < MAX_SUCCESSIVE_FAILURES
    ) {
        const deployContent = await deployQueueServer.readQueuedAndPendingFiles()
        // Truncate file immediately. Ideally this would be an atomic action, otherwise it's
        // possible that another process writes to this file in the meantime...
        await deployQueueServer.clearQueueFile()
        // Write to `.deploying` file to be able to recover the deploy message
        // in case of failure.
        await deployQueueServer.writePendingFile(deployContent)
        const message = generateCommitMsg(
            deployQueueServer.parseQueueContent(deployContent)
        )
        console.log(`Deploying site...\n---\n${message}\n---`)
        try {
            await bakeAndDeploy(message)
            await deployQueueServer.deletePendingFile()
        } catch (err) {
            failures++
            // The error is already sent to Slack inside the deploy() function.
            // The deploy will be retried unless we've reached MAX_SUCCESSIVE_FAILURES.
        }
    }
    deploying = false
}
