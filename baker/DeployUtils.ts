import * as _ from "lodash-es"
import fs from "fs-extra"
import { BuildkiteTrigger } from "../baker/BuildkiteTrigger.js"
import { DeployQueueServer } from "./DeployQueueServer.js"
import {
    BAKED_SITE_DIR,
    BAKED_BASE_URL,
    BUILDKITE_API_ACCESS_TOKEN,
    SLACK_BOT_OAUTH_TOKEN,
    ENV,
} from "../settings/serverSettings.js"
import { SiteBaker } from "../baker/SiteBaker.js"
import { WebClient } from "@slack/web-api"
import { DeployChange, DeployMetadata } from "@ourworldindata/utils"
import { KnexReadonlyTransaction } from "../db/db.js"

const deployQueueServer = new DeployQueueServer()

export const defaultCommitMessage = async (): Promise<string> => {
    let message = "Automated update"

    // In the deploy.sh script, we write the current git rev to 'public/head.txt'
    // and want to include it in the deploy commit message
    try {
        const sha = await fs.readFile("public/head.txt", "utf8")
        message += `\nowid/owid-grapher@${sha}`
    } catch (err) {
        console.warn(err)
    }

    return message
}

/**
 * Initiate a deploy, without any checks. Throws error on failure.
 */

const triggerBakeAndDeploy = async (
    deployMetadata: DeployMetadata,
    knex: KnexReadonlyTransaction,
    lightningQueue?: DeployChange[]
) => {
    // deploy to Buildkite if we're on master and BUILDKITE_API_ACCESS_TOKEN is set
    if (BUILDKITE_API_ACCESS_TOKEN) {
        const buildkite = new BuildkiteTrigger()
        if (lightningQueue?.length) {
            await buildkite.runLightningBuild(
                lightningQueue.map((change) => change.slug!),
                deployMetadata
            )
        } else {
            await buildkite.runFullBuild(deployMetadata)
        }
    } else {
        // otherwise, bake locally. This is used for local development or staging servers
        const baker = new SiteBaker(BAKED_SITE_DIR, BAKED_BASE_URL)
        if (lightningQueue?.length) {
            if (!lightningQueue.every((change) => change.slug))
                throw new Error("Lightning deploy is missing a slug")

            await baker.bakeGDocPosts(
                knex,
                lightningQueue.map((c) => c.slug!)
            )
        } else {
            await baker.bakeAll(knex)
        }
    }
}

const getChangesAuthorNames = (queueItems: DeployChange[]): string[] => {
    // Do not remove duplicates here, because we want to show the history of changes within a deploy
    return queueItems
        .map((item) => `${item.message} (by ${item.authorName})`)
        .filter(Boolean)
}

const getChangesSlackMentions = async (
    queueItems: DeployChange[]
): Promise<string[]> => {
    const emailSlackMentionMap = await getEmailSlackMentionsMap(queueItems)

    // Do not remove duplicates here, because we want to show the history of changes within a deploy
    return queueItems.map(
        (item) =>
            `${item.message} (by ${
                !item.authorEmail
                    ? item.authorName
                    : (emailSlackMentionMap.get(item.authorEmail) ??
                      item.authorName)
            })`
    )
}

const getEmailSlackMentionsMap = async (
    queueItems: DeployChange[]
): Promise<Map<string, string>> => {
    if (ENV === "staging" || !SLACK_BOT_OAUTH_TOKEN) return new Map()

    const slackClient = new WebClient(SLACK_BOT_OAUTH_TOKEN)

    // Get unique author emails
    const uniqueAuthorEmails = [
        ...new Set(queueItems.map((item) => item.authorEmail)),
    ]

    // Get a Map of email -> Slack mention (e.g. "<@U123456>")
    const emailSlackMentionMap = new Map()
    await Promise.all(
        uniqueAuthorEmails.map(async (authorEmail) => {
            if (authorEmail) {
                const slackId = await getSlackMentionByEmail(
                    authorEmail,
                    slackClient
                )
                if (slackId) {
                    emailSlackMentionMap.set(authorEmail, slackId)
                }
            }
        })
    )

    return emailSlackMentionMap
}

/**
 *
 * Get a Slack mention for a given email address. Format it according to the
 * Slack API requirements to mention a user in a message
 * (https://api.slack.com/reference/surfaces/formatting#mentioning-users).
 * Slack has a tight limit of 20 requests per minute for email lookups, so we
 * memoize this.
 */
const getSlackMentionByEmail = _.memoize(
    async (
        email: string | undefined,
        slackClient: WebClient
    ): Promise<string | undefined> => {
        if (!email || email === "etl@ourworldindata.org") return

        try {
            const response = await slackClient.users.lookupByEmail({ email })
            return response.user?.id ? `<@${response.user.id}>` : undefined
        } catch (error) {
            throw new Error(
                `Error looking up email "${email}" in slack: ${error}`
            )
        }
    }
)

/**
 * Initiate deploy if no other deploy is currently pending, and there are changes
 * in the queue.
 * If there is a deploy pending, another one will be automatically triggered at
 * the end of the current one, as long as there are changes in the queue.
 * If there are no changes in the queue, a deploy won't be initiated.
 */
export const deployIfQueueIsNotEmpty = async (
    knex: KnexReadonlyTransaction
) => {
    if (!(await deployQueueServer.queueIsEmpty())) {
        const deployContent =
            await deployQueueServer.readQueuedAndPendingFiles()
        // Truncate file immediately. Ideally this would be an atomic action, otherwise it's
        // possible that another process writes to this file in the meantime...
        await deployQueueServer.clearQueueFile()
        // Write to `.pending` file to be able to recover the deploy message
        // in case of failure.
        await deployQueueServer.writePendingFile(deployContent)

        const parsedQueue = deployQueueServer.parseQueueContent(deployContent)

        // Log the changes that are about to be deployed in a text format.
        const dateStr: string = new Date().toISOString()
        const changesAuthorNames = getChangesAuthorNames(parsedQueue)
        console.log(
            `Deploying site...\n---\n📆 ${dateStr}\n\n${changesAuthorNames.join(
                "\n"
            )}\n---`
        )

        const changesSlackMentions = await getChangesSlackMentions(parsedQueue)
        await triggerBakeAndDeploy(
            { title: changesAuthorNames[0], changesSlackMentions },
            knex,
            // If every DeployChange is a lightning change, then we can do a
            // lightning deploy. In the future, we might want to separate
            // lightning updates from regular deploys so we could prioritize
            // them, no matter the content of the queue.
            parsedQueue.every(isLightningChange) ? parsedQueue : undefined
        )
        await deployQueueServer.deletePendingFile()
    }
}

const isLightningChange = (item: DeployChange) => item.slug
