import fs from "fs-extra"
import { BuildkiteTrigger } from "../baker/BuildkiteTrigger.js"
import { logErrorAndMaybeSendToBugsnag, warn } from "../serverUtils/errorLog.js"
import { DeployQueueServer } from "./DeployQueueServer.js"
import {
    BAKED_SITE_DIR,
    BAKED_BASE_URL,
    BUILDKITE_API_ACCESS_TOKEN,
} from "../settings/serverSettings.js"
import { DeployChange } from "@ourworldindata/utils"
import { SiteBaker } from "../baker/SiteBaker.js"

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
const triggerBakeAndDeploy = async (
    message?: string,
    lightningQueue?: DeployChange[]
) => {
    message = message ?? (await defaultCommitMessage())

    // deploy to Buildkite if we're on master and BUILDKITE_API_ACCESS_TOKEN is set
    if (BUILDKITE_API_ACCESS_TOKEN) {
        const buildkite = new BuildkiteTrigger()
        if (lightningQueue?.length) {
            // first run lightning gdocs
            await buildkite
                .runLightningGdocBuild(
                    message!,
                    lightningQueue
                        .map((change) => change.gdocSlug!)
                        .filter(Boolean)
                )
                .catch(logErrorAndMaybeSendToBugsnag)

            // then run chart builds
            await buildkite
                .runLightningChartBuild(
                    message!,
                    lightningQueue
                        .map((change) => change.chartSlug!)
                        .filter(Boolean)
                )
                .catch(logErrorAndMaybeSendToBugsnag)
        } else {
            await buildkite
                .runFullBuild(message)
                .catch(logErrorAndMaybeSendToBugsnag)
        }
    } else {
        // otherwise, bake locally. This is used for local development or staging servers
        const baker = new SiteBaker(BAKED_SITE_DIR, BAKED_BASE_URL)
        if (lightningQueue?.length) {
            await baker.bakeGDocPosts(
                lightningQueue.map((c) => c.gdocSlug!).filter(Boolean)
            )
            await baker.bakeCharts(
                lightningQueue.map((c) => c.chartSlug!).filter(Boolean)
            )
        } else {
            await baker.bakeAll()
        }
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
        const deployContent =
            await deployQueueServer.readQueuedAndPendingFiles()
        // Truncate file immediately. Ideally this would be an atomic action, otherwise it's
        // possible that another process writes to this file in the meantime...
        await deployQueueServer.clearQueueFile()
        // Write to `.pending` file to be able to recover the deploy message
        // in case of failure.
        await deployQueueServer.writePendingFile(deployContent)

        const parsedQueue = deployQueueServer.parseQueueContent(deployContent)

        const message = generateCommitMsg(parsedQueue)
        console.log(`Deploying site...\n---\n${message}\n---`)
        try {
            await triggerBakeAndDeploy(
                message,
                // If every DeployChange is a lightning change, then we can do a
                // lightning deploy. In the future, we might want to separate
                // lightning updates from regular deploys so we could prioritize
                // them, no matter the content of the queue.
                parsedQueue.every(isLightningChange) ? parsedQueue : undefined
            )
            await deployQueueServer.deletePendingFile()
        } catch (err) {
            failures++
            // The error is already sent to Slack inside the deploy() function.
            // The deploy will be retried unless we've reached MAX_SUCCESSIVE_FAILURES.
        }
    }
    deploying = false
}

const isLightningChange = (item: DeployChange) =>
    item.gdocSlug || item.chartSlug
