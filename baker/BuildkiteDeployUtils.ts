import * as _ from "lodash-es"
import { WebClient } from "@slack/web-api"
import { DeployChange, DeployMetadata } from "@ourworldindata/utils"
import { ENV, SLACK_BOT_OAUTH_TOKEN } from "../settings/serverSettings.js"
import { BuildkiteTrigger } from "./BuildkiteTrigger.js"

export const getChangesAuthorNames = (queueItems: DeployChange[]): string[] => {
    // Do not remove duplicates here, because we want to show the history of changes within a deploy
    return queueItems
        .map((item) => `${item.message} (by ${item.authorName})`)
        .filter(Boolean)
}

export const getChangesSlackMentions = async (
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

export const getDeployMetadata = async (
    queueItems: DeployChange[]
): Promise<DeployMetadata> => {
    const changesAuthorNames = getChangesAuthorNames(queueItems)
    const changesSlackMentions = await getChangesSlackMentions(queueItems)
    return {
        title: changesAuthorNames[0],
        changesSlackMentions,
    }
}

export const triggerBuildkiteDeploy = async (
    queueItems: DeployChange[]
): Promise<void> => {
    if (!queueItems.length) return

    const buildkite = new BuildkiteTrigger()
    const deployMetadata = await getDeployMetadata(queueItems)

    if (queueItems.every(isLightningChange)) {
        await buildkite.triggerLightningBuild(
            queueItems.map((change) => change.slug!),
            deployMetadata
        )
    } else {
        await buildkite.triggerFullBuild(deployMetadata)
    }
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
            // Handle users_not_found gracefully - user might not be in Slack workspace
            if (error && typeof error === "object" && "data" in error) {
                const slackError = error as { data?: { error?: string } }
                if (slackError.data?.error === "users_not_found") {
                    console.warn(`User not found in Slack workspace: ${email}`)
                    return undefined
                }
            }
            // For other Slack API errors, log but don't fail the deploy
            console.error(
                `Warning: Could not look up email "${email}" in Slack:`,
                error
            )
            return undefined
        }
    }
)

const isLightningChange = (item: DeployChange) => item.slug
