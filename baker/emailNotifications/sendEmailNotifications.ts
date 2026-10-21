// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import { traceJob } from "../../serverUtils/sentryTracing.js"
import fs from "fs-extra"
import path from "path"
import { v7 as uuidv7 } from "uuid"
import * as _ from "lodash-es"
import { Models, ServerClient } from "postmark"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import {
    EMAIL_NOTIFICATIONS_FREQUENCIES,
    EMAIL_NOTIFICATIONS_FROM_ADDRESS,
    EmailNotificationsFrequency,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import {
    BASE_DIR,
    BAKED_BASE_URL,
    POSTMARK_API_BASE_URL,
    POSTMARK_SERVER_TOKEN,
} from "../../settings/serverSettings.js"
import {
    D1Client,
    createLocalD1Client,
    createRemoteD1Client,
    queryWithRetry,
} from "./emailNotificationsD1.js"
import {
    D1SubscriberRow,
    EmailNotificationsSubscriber,
    NotificationEmailGroup,
    NotificationEmailItem,
    areWebhooksMissing,
    fillPostmarkTemplate,
    getWindowStart,
    groupSubscribersByItems,
    parseSubscriberRow,
} from "./emailNotificationsUtils.js"
import { buildNotificationItems } from "./notificationItems.js"
import { renderNotificationEmail } from "./NotificationEmail.js"

// Must match the database_name in wrangler.jsonc; only used with --local.
const LOCAL_D1_DATABASE_NAME = "owid-email-notifications-staging"

const PREVIEW_DIR = path.join(BASE_DIR, ".email-notifications-preview")

// Never include content older than this, even if a subscriber's lastSentAt
// is much older (e.g. because the send job was down for a while).
const MAX_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

async function fetchSubscribers(
    d1: D1Client,
    frequency: EmailNotificationsFrequency
): Promise<EmailNotificationsSubscriber[]> {
    const rows = await d1.query<D1SubscriberRow>(
        `SELECT users.id AS userId, users.email, users.token,
                notification_preferences.topicTags,
                notification_preferences.contentTypes,
                notification_preferences.frequency,
                (SELECT MAX(messages.sentAt)
                 FROM messages
                 WHERE messages.userId = users.id) AS lastSentAt
         FROM users
         JOIN notification_preferences
             ON notification_preferences.userId = users.id
         WHERE users.emailNotificationsStatus = 'subscribed'
             AND NOT EXISTS (
                 SELECT 1
                 FROM postmark_suppressions
                 WHERE postmark_suppressions.email = users.email
                     AND postmark_suppressions.messageStream = 'broadcast'
                     AND postmark_suppressions.isSuppressed = 1
             )
             AND notification_preferences.frequency = ?1`,
        [frequency]
    )
    return rows.map(parseSubscriberRow)
}

/**
 * Postmark client for the digest sends. POSTMARK_API_BASE_URL may point at the
 * local Postmark catcher (yarn postmarkCatcher), which the SDK expects split
 * into scheme and host.
 */
function createPostmarkClient(): ServerClient {
    if (!POSTMARK_SERVER_TOKEN) {
        throw new Error("POSTMARK_SERVER_TOKEN is not configured")
    }
    const { protocol, host } = new URL(POSTMARK_API_BASE_URL)
    return new ServerClient(
        POSTMARK_SERVER_TOKEN,
        new Models.ClientOptions.Configuration(protocol === "https:", host)
    )
}

// D1 limits a bound string to 2 MB; a JSON row of a recorded message is about
// 100 bytes.
const D1_RECORD_CHUNK_SIZE = 1000

// Postmark limits a bulk request to 50 MB; a message is about 250 bytes of
// JSON, so a full chunk is about 6 MB. Smaller chunks mean fewer re-sent
// emails if a request times out or we crash before recording it.
const POSTMARK_BULK_CHUNK_SIZE = 25_000

/**
 * Per-recipient values, filled in by Postmark from each message's
 * TemplateModel. Triple braces insert them unescaped, so the same placeholder
 * works in the HTML and text bodies. Tokens are UUIDs, and the address only
 * appears in its recipient's own email.
 */
const TEMPLATE_TOKEN = "{{{token}}}"
const TEMPLATE_EMAIL = "{{{email}}}"

interface NotificationEmailTemplate {
    subject: string
    html: string
    text: string
}

/**
 * Render a group's email once, with template variables in place of the
 * recipient's details.
 *
 * Postmark parses the whole body as a template. A stray "{{" in our content
 * passes through as is, but template syntax would be interpreted, or break
 * the template, which isTemplateValid catches. We accept that for now because
 * our content practically never contains it.
 */
async function renderNotificationEmailTemplate(
    group: NotificationEmailGroup,
    now: Date
): Promise<NotificationEmailTemplate> {
    return renderNotificationEmail({
        subscriber: {
            ...group.subscribers[0],
            token: TEMPLATE_TOKEN,
            email: TEMPLATE_EMAIL,
        },
        items: group.items,
        baseUrl: BAKED_BASE_URL,
        // Links in emails must be absolute; the email notifications API is
        // served on the same host as the baked site.
        apiBaseUrl: `${BAKED_BASE_URL}/api/email-notifications`,
        now,
    })
}

/**
 * The values for the template placeholders above. Shared by sending and
 * previews so the placeholders and their values stay in sync.
 */
function makeTemplateModel(
    subscriber: EmailNotificationsSubscriber
): Record<string, string> {
    return { token: subscriber.token, email: subscriber.email }
}

interface PreparedMessage {
    subscriber: EmailNotificationsSubscriber
    /**
     * Sent as message metadata, so webhooks can find the messages row. The
     * bulk API doesn't return per-recipient Postmark message IDs.
     */
    correlationId: string
}

/**
 * Check that Postmark can parse the template. The bulk API accepts a request
 * with a broken template, e.g. an unclosed block, and only fails its messages
 * later, while processing it.
 */
async function isTemplateValid(
    client: ServerClient,
    group: NotificationEmailGroup,
    template: NotificationEmailTemplate,
    groupLog: string
): Promise<boolean> {
    const validation = await client.validateTemplate({
        Subject: template.subject,
        HtmlBody: template.html,
        TextBody: template.text,
        TestRenderModel: makeTemplateModel(group.subscribers[0]),
    })
    if (validation.AllContentIsValid) return true
    const errors = {
        subject: validation.Subject?.ValidationErrors,
        html: validation.HtmlBody?.ValidationErrors,
        text: validation.TextBody?.ValidationErrors,
    }
    console.error(
        `Group skipped because Postmark rejected its template ${groupLog} errors=${JSON.stringify(errors)}`
    )
    return false
}

/**
 * Submit a chunk of a group's email as one Postmark bulk request. Returns
 * the bulk request id.
 */
async function sendBulkViaPostmark(
    client: ServerClient,
    frequency: EmailNotificationsFrequency,
    template: NotificationEmailTemplate,
    messages: PreparedMessage[]
): Promise<string> {
    const response = await client.sendBulkEmail({
        From: EMAIL_NOTIFICATIONS_FROM_ADDRESS,
        Subject: template.subject,
        HtmlBody: template.html,
        // Text alternative for clients that don't render HTML, and one of
        // the signals spam filters weigh.
        TextBody: template.text,
        // Bulk emails must go through a Postmark broadcast stream (not the
        // transactional "outbound" stream). Postmark adds the unsubscribe
        // headers automatically.
        MessageStream: "broadcast",
        Tag: "email-notifications", // For analytics
        Messages: messages.map(({ subscriber, correlationId }) => ({
            To: subscriber.email,
            TemplateModel: makeTemplateModel(subscriber),
            Metadata: {
                userId: String(subscriber.userId),
                frequency,
                correlationId,
            },
        })),
    })
    if (response.Status !== Models.BulkEmailStatus.Accepted) {
        throw new Error(
            `Postmark did not accept the bulk request status=${response.Status}`
        )
    }
    return response.Id
}

/**
 * Record a group's messages, one write per chunk rather than per subscriber:
 * each write is a request to the Cloudflare API, which is rate limited. Each
 * chunk is a single statement, so a subscriber is either recorded, which
 * also advances their window, or not. The statement ignores rows that are
 * already recorded, so it's safe to retry after a write that failed but may
 * have been committed.
 */
async function recordSentMessages(
    d1: D1Client,
    frequency: EmailNotificationsFrequency,
    items: NotificationEmailItem[],
    messages: PreparedMessage[],
    bulkRequestId: string,
    sentAt: Date
): Promise<void> {
    const itemSlugs = JSON.stringify(items.map((item) => item.slug))
    for (const chunk of _.chunk(messages, D1_RECORD_CHUNK_SIZE)) {
        const rows = JSON.stringify(
            chunk.map(({ subscriber, correlationId }) => ({
                userId: subscriber.userId,
                correlationId,
            }))
        )
        await queryWithRetry(
            d1,
            `INSERT INTO messages
                 (userId, frequency, itemSlugs, correlationId, bulkRequestId,
                  status, sentAt)
             SELECT json_extract(value, '$.userId'), ?1, ?2,
                 json_extract(value, '$.correlationId'), ?3, 'sent', ?4
             FROM json_each(?5)
             -- SQLite needs a WHERE before ON CONFLICT in INSERT ... SELECT.
             WHERE true
             ON CONFLICT (correlationId) DO NOTHING`,
            [frequency, itemSlugs, bulkRequestId, sentAt.toISOString(), rows]
        )
    }
}

/** Postmark returns these counts, but the SDK's type leaves them out. */
interface BulkEmailStatusWithCounts extends Models.BulkEmailStatusResponse {
    ReleasedCount?: number
    FailedCount?: number
}

/**
 * Report bulk requests from the previous run of this frequency that Postmark
 * failed to send in full. Failed messages never reach the sending pipeline,
 * so no webhook tells us about them, but their recipients' windows have
 * already advanced.
 *
 * A failure of every message usually means a template error; deleting the
 * request's messages rows makes the next run send it again. A few failures
 * usually mean recipients on Postmark's suppression list that a missed
 * webhook didn't tell us about.
 */
async function checkPreviousBulkRequests(
    d1: D1Client,
    client: ServerClient,
    frequency: EmailNotificationsFrequency
): Promise<void> {
    const rows = await d1.query<{ bulkRequestId: string }>(
        `SELECT DISTINCT bulkRequestId
         FROM messages
         WHERE frequency = ?1
             AND sentAt = (SELECT MAX(sentAt) FROM messages WHERE frequency = ?1)`,
        [frequency]
    )
    for (const { bulkRequestId } of rows) {
        let status: BulkEmailStatusWithCounts
        try {
            status = await client.getBulkEmailStatus(bulkRequestId)
        } catch (error) {
            // Not worth stopping the send over.
            console.warn(
                `Bulk request status lookup failed bulkRequestId=${bulkRequestId} error=${JSON.stringify(String(error))}`
            )
            Sentry.captureException(error, {
                level: "warning",
                extra: { bulkRequestId },
            })
            continue
        }
        const failedCount = status.FailedCount ?? 0
        const log = `bulkRequestId=${bulkRequestId} status=${status.Status} totalCount=${status.TotalMessages} releasedCount=${status.ReleasedCount} failedCount=${failedCount}`
        if (
            status.Status === Models.BulkEmailStatus.Failed ||
            failedCount > 0
        ) {
            console.error(`Previous bulk request did not send in full ${log}`)
            Sentry.captureMessage(
                "Email notifications bulk request did not send in full",
                { level: "error", extra: { ...status } }
            )
        } else {
            console.log(`Previous bulk request checked ${log}`)
        }
    }
}

/**
 * Report if Postmark webhooks have stopped arriving. Without them, unsubscribes
 * and suppressions don't reach D1, and nothing else would tell us.
 */
async function checkWebhooksArriving(d1: D1Client, now: Date): Promise<void> {
    const [row] = await d1.query<{
        lastSentAt: string | null
        lastWebhookAt: string | null
    }>(
        `SELECT (SELECT MAX(sentAt) FROM messages) AS lastSentAt,
                (SELECT MAX(processedAt) FROM postmark_webhook_receipts)
                    AS lastWebhookAt`
    )
    const lastSentAt = row?.lastSentAt ? new Date(row.lastSentAt) : null
    const lastWebhookAt = row?.lastWebhookAt
        ? new Date(row.lastWebhookAt)
        : null
    if (areWebhooksMissing({ lastSentAt, lastWebhookAt, now })) {
        console.error(
            `No Postmark webhooks received since the last send lastSentAt=${row?.lastSentAt} lastWebhookAt=${row?.lastWebhookAt}`
        )
        Sentry.captureMessage(
            "No Postmark webhooks received since the last email notification send",
            "error"
        )
    }
}

async function writePreview(
    group: NotificationEmailGroup,
    groupIndex: number,
    frequency: EmailNotificationsFrequency,
    template: NotificationEmailTemplate
): Promise<string> {
    // Filled in for the group's first subscriber, as Postmark would.
    const model = makeTemplateModel(group.subscribers[0])
    const previewPath = path.join(
        PREVIEW_DIR,
        `group-${groupIndex + 1}-${frequency}.html`
    )
    await fs.outputFile(previewPath, fillPostmarkTemplate(template.html, model))
    await fs.outputFile(
        previewPath.replace(/\.html$/, ".txt"),
        fillPostmarkTemplate(template.text, model)
    )
    return previewPath
}

/**
 * Sends each group of subscribers with the same items in bulk requests of up
 * to POSTMARK_BULK_CHUNK_SIZE recipients.
 *
 * We don't wait for Postmark to process the requests; the next run checks
 * how they went. A group whose template Postmark rejects is skipped and
 * retried on the next run, and fails this run once the other groups are sent.
 */
async function sendEmailNotifications(options: {
    frequency: EmailNotificationsFrequency
    dryRun: boolean
    local: boolean
}): Promise<void> {
    const { frequency, dryRun, local } = options
    const d1 = local
        ? createLocalD1Client(LOCAL_D1_DATABASE_NAME)
        : createRemoteD1Client()

    const now = new Date()
    // Webhooks never reach the local database.
    if (!local) await checkWebhooksArriving(d1, now)

    const subscribers = await fetchSubscribers(d1, frequency)
    if (subscribers.length === 0) return
    // Fetch content back to the oldest window start of any subscriber (capped
    // at MAX_WINDOW_MS), then filter per subscriber. _.min rather than
    // Math.min(...) because spreading a very large array exceeds the call
    // stack.
    const oldestWindowStart =
        _.min(
            subscribers.map((subscriber) =>
                getWindowStart(subscriber, now).getTime()
            )
        ) ?? now.getTime()
    const minWindowStart = new Date(
        Math.max(oldestWindowStart, now.getTime() - MAX_WINDOW_MS)
    )
    const items = await db.knexReadonlyTransaction(
        (trx) => buildNotificationItems(trx, minWindowStart),
        db.TransactionCloseMode.Close
    )

    const groups = groupSubscribersByItems(items, subscribers, now)
    const groupedCount = _.sumBy(groups, (group) => group.subscribers.length)
    console.log(
        `Subscribers grouped subscriberCount=${subscribers.length} skippedWithoutNewItems=${subscribers.length - groupedCount} groupCount=${groups.length}`
    )

    // Constructed once, and only when we're actually sending.
    const postmarkClient = dryRun ? undefined : createPostmarkClient()
    if (postmarkClient)
        await checkPreviousBulkRequests(d1, postmarkClient, frequency)

    let invalidTemplateGroupCount = 0
    for (const [groupIndex, group] of groups.entries()) {
        const template = await renderNotificationEmailTemplate(group, now)
        const groupLog = `group=${groupIndex + 1} recipientCount=${group.subscribers.length} itemSlugs=${JSON.stringify(group.items.map((item) => item.slug).join(", "))}`

        if (!postmarkClient) {
            // Dry run
            const previewPath = await writePreview(
                group,
                groupIndex,
                frequency,
                template
            )
            console.log(
                `Email preview written ${groupLog} previewPath=${JSON.stringify(previewPath)}`
            )
            continue
        }

        if (
            !(await isTemplateValid(postmarkClient, group, template, groupLog))
        ) {
            invalidTemplateGroupCount++
            continue
        }

        const chunks = _.chunk(group.subscribers, POSTMARK_BULK_CHUNK_SIZE)
        for (const [chunkIndex, chunk] of chunks.entries()) {
            // Deliberate ordering: send first, record after. A crash between
            // the two means the next run re-sends this chunk's emails — a
            // rare duplicate is preferable to the reverse order, where a
            // crash would silently drop the emails forever.
            const messages = chunk.map((subscriber) => ({
                subscriber,
                correlationId: uuidv7(),
            }))
            const bulkRequestId = await sendBulkViaPostmark(
                postmarkClient,
                frequency,
                template,
                messages
            )
            try {
                await recordSentMessages(
                    d1,
                    frequency,
                    group.items,
                    messages,
                    bulkRequestId,
                    now
                )
            } catch (error) {
                // Postmark is already sending these emails, so the next run
                // will send them again unless they're recorded by hand.
                console.error(
                    `Recording sent messages failed bulkRequestId=${bulkRequestId} userIds=${messages.map(({ subscriber }) => subscriber.userId).join(",")}`
                )
                throw error
            }
            console.log(
                `Bulk request submitted ${groupLog} chunk=${chunkIndex + 1}/${chunks.length} chunkRecipientCount=${messages.length} bulkRequestId=${bulkRequestId}`
            )
        }
    }

    if (invalidTemplateGroupCount > 0) {
        throw new Error(
            `Postmark rejected the template of ${invalidTemplateGroupCount} group(s); their emails will be retried on the next run`
        )
    }
}

void yargs(hideBin(process.argv))
    .command<{
        frequency: EmailNotificationsFrequency
        dryRun: boolean
        local: boolean
    }>(
        "$0 <frequency>",
        "Send notification emails to subscribers with the given frequency",
        (yargs) => {
            yargs
                .positional("frequency", {
                    type: "string",
                    choices: EMAIL_NOTIFICATIONS_FREQUENCIES,
                    describe: "Which subscribers to send to",
                })
                .option("dry-run", {
                    type: "boolean",
                    default: false,
                    describe: `Render the emails to ${PREVIEW_DIR} instead of sending them`,
                })
                .option("local", {
                    type: "boolean",
                    default: false,
                    describe:
                        "Read subscribers from the local wrangler D1 database instead of the remote one",
                })
        },
        async ({ frequency, dryRun, local }) => {
            try {
                await traceJob("send-email-notifications", () =>
                    sendEmailNotifications({ frequency, dryRun, local })
                )
                await Sentry.close(2000)
                process.exit(0)
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error)
                console.error(
                    `Email notification run failed error=${JSON.stringify(errorMessage)}`
                )
                Sentry.captureException(error)
                await Sentry.close()
                process.exit(1)
            }
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
