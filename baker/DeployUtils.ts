import * as _ from "lodash-es"
import { BuildkiteTrigger } from "../baker/BuildkiteTrigger.js"
import {
    BAKE_ON_CHANGE,
    BUILDKITE_API_ACCESS_TOKEN,
    SLACK_BOT_OAUTH_TOKEN,
    ENV,
} from "../settings/serverSettings.js"
import { WebAPIPlatformError, WebClient } from "@slack/web-api"
import { DbPlainUser, DeployChange } from "@ourworldindata/utils"
import { KnexReadWriteTransaction, runAfterCommit } from "../db/db.js"

type DeployAuthor = Pick<DbPlainUser, "fullName" | "email">

const changesByTransaction = new WeakMap<
    KnexReadWriteTransaction,
    DeployChange[]
>()

/**
 * Deploy this edit once `trx` commits. All the changes a transaction enqueues
 * go out as one Buildkite build: the edit's caller waits for the build
 * request (with a timeout), never for the build. A rolled-back transaction
 * requests nothing. A failed request is logged to Sentry and doesn't fail
 * the edit, which then goes out with the next deploy.
 *
 * Does nothing unless BAKE_ON_CHANGE is set (it isn't in local dev).
 */
export const enqueueDeployChange = (
    trx: KnexReadWriteTransaction,
    user: DeployAuthor,
    message: string
): void => {
    if (!BAKE_ON_CHANGE) {
        console.log(`Not deploying "${message}": BAKE_ON_CHANGE is false`)
        return
    }

    const change = toDeployChange(user, message)
    const changes = changesByTransaction.get(trx)
    if (changes) {
        changes.push(change)
        return
    }
    // The first change registers the one request; later ones join its list
    const newChanges = [change]
    changesByTransaction.set(trx, newChanges)
    runAfterCommit(trx, async () => {
        await requestContentDeploy(newChanges)
    })
}

export const toDeployChange = (
    user: DeployAuthor,
    message: string
): DeployChange => ({
    timeISOString: new Date().toISOString(),
    authorName: user.fullName,
    authorEmail: user.email,
    message,
})

/** Request one content deploy for `changes`. Throws if the request fails. */
export const requestContentDeploy = async (
    changes: DeployChange[]
): Promise<number> => {
    if (!BUILDKITE_API_ACCESS_TOKEN)
        throw new Error(
            "BAKE_ON_CHANGE is set but BUILDKITE_API_ACCESS_TOKEN isn't, so this server can't request deploys"
        )

    const changesAuthorNames = getChangesAuthorNames(changes)
    console.log(`Requesting a deploy for:\n${changesAuthorNames.join("\n")}`)
    const changesSlackMentions = await getChangesSlackMentions(changes)
    return new BuildkiteTrigger().requestContentBuild(
        { title: changesAuthorNames[0], changesSlackMentions },
        new Date()
    )
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
            // Handle users_not_found gracefully - user might not be in Slack workspace
            if (error instanceof WebAPIPlatformError) {
                if (error.data?.error === "users_not_found") {
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
