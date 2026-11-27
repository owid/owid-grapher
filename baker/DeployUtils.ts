import * as _ from "lodash-es"
import { BuildkiteTrigger } from "../baker/BuildkiteTrigger.js"
import {
    BAKE_ON_CHANGE,
    SLACK_BOT_OAUTH_TOKEN,
    ENV,
} from "../settings/serverSettings.js"
import { WebAPIPlatformError, WebClient } from "@slack/web-api"
import { DbPlainUser, DEPLOY_REQUEST_WINDOW_MS } from "@ourworldindata/utils"
import { registerExitHandler } from "../db/cleanup.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"

type DeployAuthor = Pick<DbPlainUser, "fullName" | "email">

interface DeployChange {
    authorName: string
    authorEmail: string
    message: string
}

let heldChanges: DeployChange[] = []
let windowTimer: ReturnType<typeof setTimeout> | undefined
/** Requests sent without waiting, so shutdown can wait for them */
const inFlight = new Set<Promise<void>>()

/**
 * Request a deploy for this edit. Nobody waits for the request or the build.
 *
 * The first edit after a quiet spell is requested right away. Edits in the
 * next DEPLOY_REQUEST_WINDOW_MS are held and go out together when the window
 * ends: a build requested earlier may already be baking, and may have read
 * their pages before they were saved, so it can't stand in for them. Held
 * edits are sent on shutdown too (db/cleanup.ts), so only a hard kill loses
 * them, and then they go out with the next deploy.
 *
 * Callers enqueue from inside their transaction, before it commits. That's
 * fine: a bake reads the database seconds after the request, once Buildkite
 * has started it, and an edit that then rolls back costs one redundant bake.
 *
 * A failed request goes to Sentry and doesn't fail the edit, which then goes
 * out with the next deploy.
 *
 * Does nothing unless BAKE_ON_CHANGE is set (it isn't in local dev).
 */
export const enqueueDeployChange = (
    user: DeployAuthor,
    message: string
): void => {
    if (!BAKE_ON_CHANGE) {
        console.log(`Not deploying "${message}": BAKE_ON_CHANGE is false`)
        return
    }

    const change = toDeployChange(user, message)
    if (windowTimer) {
        heldChanges.push(change)
        return
    }
    startWindow()
    send([change])
}

const startWindow = (): void => {
    windowTimer = setTimeout(endWindow, DEPLOY_REQUEST_WINDOW_MS)
}

const endWindow = (): void => {
    windowTimer = undefined
    if (!heldChanges.length) return
    const changes = heldChanges
    heldChanges = []
    // The trailing request opens a window of its own, so a steady stream of
    // edits still gets one request per window
    startWindow()
    send(changes)
}

const send = (changes: DeployChange[]): void => {
    const request = sendLoggingErrors(changes).finally(() =>
        inFlight.delete(request)
    )
    inFlight.add(request)
}

/**
 * Send the held edits now and wait for every request still in flight, e.g.
 * before the process exits
 */
export const flushHeldDeployChanges = async (): Promise<void> => {
    clearTimeout(windowTimer)
    windowTimer = undefined
    const changes = heldChanges
    heldChanges = []
    if (changes.length) send(changes)
    await Promise.all(inFlight)
}

registerExitHandler(flushHeldDeployChanges)

const sendLoggingErrors = async (changes: DeployChange[]): Promise<void> => {
    try {
        await requestContentDeploy(changes)
    } catch (error) {
        // One Sentry issue for every failed request, whatever Buildkite
        // answered, so a single alert rule catches them all
        await logErrorAndMaybeCaptureInSentry(error, {
            level: "error",
            tags: { deploy: "request-failed" },
            fingerprint: ["deploy-request-failed"],
        })
    }
}

/** The admin's "Deploy now" button. Throws if the request fails. */
export const requestManualDeploy = async (
    user: DeployAuthor
): Promise<number> =>
    requestContentDeploy([toDeployChange(user, "Manually triggered deploy")])

const toDeployChange = (user: DeployAuthor, message: string): DeployChange => ({
    authorName: user.fullName,
    authorEmail: user.email,
    message,
})

/** Request one content deploy for `changes`. Throws if the request fails. */
const requestContentDeploy = async (
    changes: DeployChange[]
): Promise<number> => {
    const changesAuthorNames = getChangesAuthorNames(changes)
    console.log(`Requesting a deploy for:\n${changesAuthorNames.join("\n")}`)
    const changesSlackMentions = await getChangesSlackMentions(changes)
    return new BuildkiteTrigger().requestContentBuild({
        title: changesAuthorNames[0],
        changesSlackMentions,
    })
}

const getChangesAuthorNames = (queueItems: DeployChange[]): string[] => {
    // Do not remove duplicates here, because we want to show the history of changes within a deploy
    return queueItems.map((item) => `${item.message} (by ${item.authorName})`)
}

const getChangesSlackMentions = async (
    queueItems: DeployChange[]
): Promise<string[]> => {
    const emailSlackMentionMap = await getEmailSlackMentionsMap(queueItems)

    // Do not remove duplicates here, because we want to show the history of changes within a deploy
    return queueItems.map(
        (item) =>
            `${item.message} (by ${
                emailSlackMentionMap.get(item.authorEmail) ?? item.authorName
            })`
    )
}

const getEmailSlackMentionsMap = async (
    queueItems: DeployChange[]
): Promise<Map<string, string>> => {
    if (ENV === "staging" || !SLACK_BOT_OAUTH_TOKEN) return new Map()

    // The build request waits for these lookups, so fail fast instead of the
    // client's default of retrying for minutes; a failed lookup just shows
    // the author's name instead of a mention
    const slackClient = new WebClient(SLACK_BOT_OAUTH_TOKEN, {
        timeout: 5_000,
        retryConfig: { retries: 0 },
        rejectRateLimitedCalls: true,
    })

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
