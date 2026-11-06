import * as _ from "lodash-es"
import { BuildkiteTrigger } from "../baker/BuildkiteTrigger.js"
import {
    BAKE_ON_CHANGE,
    SLACK_BOT_OAUTH_TOKEN,
    ENV,
} from "../settings/serverSettings.js"
import { WebAPIPlatformError, WebClient } from "@slack/web-api"
import { DbPlainUser } from "@ourworldindata/utils"
import { KnexReadWriteTransaction, runAfterCommit } from "../db/db.js"
import { registerExitHandler } from "../db/cleanup.js"
import { logErrorAndMaybeCaptureInSentry } from "../serverUtils/errorLog.js"

type DeployAuthor = Pick<DbPlainUser, "fullName" | "email">

interface DeployChange {
    authorName: string
    authorEmail: string
    message: string
}

const changesByTransaction = new WeakMap<
    KnexReadWriteTransaction,
    DeployChange[]
>()

/**
 * At most one build request per window, plus a trailing one for what the
 * window held. An ETL push calls the admin API once per indicator or chart, a
 * few hundred times in minutes; this turns that into a handful of requests.
 *
 * Keep it longer than a content build takes (~4–5 min on prod, with the
 * archive), so requests never come faster than builds finish and don't queue
 * up behind the deploy lock. If bakes get slower, raise it.
 */
export const DEPLOY_REQUEST_WINDOW_MS = 5 * 60_000

let heldChanges: DeployChange[] = []
let windowTimer: ReturnType<typeof setTimeout> | undefined
/** Requests sent without waiting, so shutdown can wait for them */
const inFlight = new Set<Promise<void>>()

/**
 * Deploy this edit once `trx` commits. All the changes a transaction enqueues
 * go out in one Buildkite build request, and nobody waits for the request or
 * the build. A rolled-back transaction requests nothing.
 *
 * The first committed edit after a quiet spell is requested right away. Edits
 * committed in the next DEPLOY_REQUEST_WINDOW_MS are held and go out together
 * when the window ends: a build requested earlier may already be baking, and
 * may have read their pages before they committed, so it can't stand in for
 * them. Held edits are sent on shutdown too (db/cleanup.ts), so only a hard
 * kill loses them, and then they go out with the next deploy.
 *
 * A failed request is logged to Sentry and doesn't fail the edit, which then
 * goes out with the next deploy. (Changes enqueued in a savepoint wait for the
 * outermost commit, as a separate batch.)
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
    runAfterCommit(trx, async () => queueForDeploy(newChanges))
}

const queueForDeploy = (changes: DeployChange[]): void => {
    if (windowTimer) {
        heldChanges.push(...changes)
        return
    }
    startWindow()
    send(changes)
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
        await logErrorAndMaybeCaptureInSentry(error)
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
