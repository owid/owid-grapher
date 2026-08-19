// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as R from "remeda"
import * as Sentry from "@sentry/node"
import fs from "fs-extra"
import path from "path"
import { Errors, Models, ServerClient } from "postmark"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import {
    EMAIL_NOTIFICATIONS_FREQUENCIES,
    EMAIL_NOTIFICATIONS_FROM_ADDRESS,
    EmailNotificationsFrequency,
    LatestFeedGdoc,
    OwidGdocType,
} from "@ourworldindata/types"
import {
    checkIsLatestFeedGdoc,
    getUniqueNamesFromTagHierarchies,
    spansToUnformattedPlainText,
} from "@ourworldindata/utils"
import { getCanonicalUrl } from "@ourworldindata/components"
import * as db from "../../db/db.js"
import { gdocFromJSON } from "../../db/model/Gdoc/GdocFactory.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { GdocDataInsight } from "../../db/model/Gdoc/GdocDataInsight.js"
import { GdocAnnouncement } from "../../db/model/Gdoc/GdocAnnouncement.js"
import { extractFilenamesFromBlocks } from "../../db/model/Gdoc/gdocUtils.js"
import { getExcerptFromGdoc, getThumbnailUrl } from "../algolia/utils/pages.js"
import {
    BASE_DIR,
    BAKED_BASE_URL,
    CLOUDFLARE_IMAGES_URL,
    POSTMARK_API_BASE_URL,
    POSTMARK_SERVER_TOKEN,
} from "../../settings/serverSettings.js"
import {
    D1Client,
    createLocalD1Client,
    createRemoteD1Client,
} from "./emailNotificationsD1.js"
import {
    D1SubscriberRow,
    EmailNotificationsSubscriber,
    NotificationEmailItem,
    filterItemsForSubscriber,
    getWindowStart,
    parseSubscriberRow,
} from "./emailNotificationsUtils.js"
import {
    makeNotificationEmailSubject,
    renderNotificationEmail,
} from "./NotificationEmail.js"

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
                notification_preferences.lastSentAt
         FROM users
         JOIN notification_preferences
             ON notification_preferences.userId = users.id
         WHERE users.status = 'subscribed'
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

type LatestFeedGdocInstance = (GdocPost | GdocDataInsight | GdocAnnouncement) &
    LatestFeedGdoc

/**
 * Like `checkIsLatestFeedGdoc`, but narrows to the Gdoc *class* instances
 * returned by `gdocFromJSON`.
 */
function isLatestFeedGdocInstance(
    gdoc: ReturnType<typeof gdocFromJSON>
): gdoc is LatestFeedGdocInstance {
    return checkIsLatestFeedGdoc(gdoc)
}

function getFirstTextBlockPlainText(gdoc: LatestFeedGdocInstance): string {
    const body = "body" in gdoc.content ? gdoc.content.body : undefined
    const firstTextBlock = body?.find((block) => block.type === "text")
    return firstTextBlock
        ? spansToUnformattedPlainText(firstTextBlock.value)
        : ""
}

function buildNotificationItem(
    gdoc: LatestFeedGdocInstance,
    topicHierarchiesByChildName: Awaited<
        ReturnType<typeof db.getTopicHierarchiesByChildName>
    >,
    cloudflareImagesByFilename: Awaited<
        ReturnType<typeof db.getCloudflareImagesByFilename>
    >
): NotificationEmailItem {
    const originalTagNames = gdoc.tags?.map((tag) => tag.name) ?? []
    // Include the ancestor tags (e.g. the "Health" area for an item tagged
    // "Vaccination") so subscriptions to top-level areas match.
    const topicNames = R.unique([
        ...originalTagNames,
        ...getUniqueNamesFromTagHierarchies(
            originalTagNames,
            topicHierarchiesByChildName
        ),
    ])
    const item: NotificationEmailItem = {
        type: gdoc.content.type,
        slug: gdoc.slug,
        title: gdoc.content.title ?? "",
        url: getCanonicalUrl(BAKED_BASE_URL, gdoc),
        publishedAt: gdoc.publishedAt!,
        topicNames,
        topicLabel: originalTagNames[0],
        authors: gdoc.content.authors ?? [],
    }

    if (gdoc.content.type === OwidGdocType.DataInsight) {
        // Data insights ship their full content in the email.
        item.body = gdoc.content.body
        item.imageUrlByFilename = {}
        for (const filename of extractFilenamesFromBlocks(gdoc.content.body)) {
            const cloudflareId =
                cloudflareImagesByFilename[filename]?.cloudflareId
            if (cloudflareId) {
                item.imageUrlByFilename[filename] =
                    `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/w=1200`
            }
        }
    } else {
        item.excerpt =
            getExcerptFromGdoc(gdoc) || getFirstTextBlockPlainText(gdoc)
        if (gdoc.content.type === OwidGdocType.Article) {
            item.thumbnailUrl = getThumbnailUrl(
                gdoc,
                cloudflareImagesByFilename
            )
        }
    }

    return item
}

async function buildNotificationItems(
    knex: db.KnexReadonlyTransaction,
    since: Date
): Promise<NotificationEmailItem[]> {
    const gdocs = await db
        .getPublishedGdocsWithTags(
            knex,
            [
                OwidGdocType.Article,
                OwidGdocType.DataInsight,
                OwidGdocType.Announcement,
            ],
            { excludeDeprecated: true }
        )
        .then((rows) => rows.map(gdocFromJSON))

    const recentGdocs = gdocs.filter(
        (gdoc): gdoc is LatestFeedGdocInstance =>
            isLatestFeedGdocInstance(gdoc) &&
            !!gdoc.publishedAt &&
            gdoc.publishedAt > since
    )
    if (recentGdocs.length === 0) return []

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)
    const cloudflareImagesByFilename =
        await db.getCloudflareImagesByFilename(knex)

    return recentGdocs
        .map((gdoc) =>
            buildNotificationItem(
                gdoc,
                topicHierarchiesByChildName,
                cloudflareImagesByFilename
            )
        )
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
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

/** Send an email via Postmark. Returns the Postmark message id. */
async function sendViaPostmark(
    client: ServerClient,
    email: {
        to: string
        subject: string
        htmlBody: string
        metadata: Record<string, string>
    }
): Promise<string> {
    const response = await client.sendEmail({
        From: EMAIL_NOTIFICATIONS_FROM_ADDRESS,
        To: email.to,
        Subject: email.subject,
        HtmlBody: email.htmlBody,
        // Bulk emails must go through a Postmark broadcast stream (not the
        // transactional "outbound" stream). Postmark adds the unsubscribe
        // headers automatically.
        MessageStream: "broadcast",
        Tag: "email-notifications",
        Metadata: email.metadata,
    })
    return response.MessageID
}

async function recordSentEmail(
    d1: D1Client,
    subscriber: EmailNotificationsSubscriber,
    items: NotificationEmailItem[],
    postmarkMessageId: string,
    sentAt: Date
): Promise<void> {
    const sentAtIso = sentAt.toISOString()
    await d1.query(
        `UPDATE notification_preferences
         SET lastSentAt = ?1, updatedAt = ?1
         WHERE userId = ?2`,
        [sentAtIso, subscriber.userId]
    )
    await d1.query(
        `INSERT INTO messages
             (userId, frequency, itemSlugs, messageId, status, sentAt)
         VALUES (?1, ?2, ?3, ?4, 'sent', ?5)`,
        [
            subscriber.userId,
            subscriber.frequency,
            JSON.stringify(items.map((item) => item.slug)),
            postmarkMessageId,
            sentAtIso,
        ]
    )
}

interface SendFailure {
    userId: number
    error: unknown
}

/**
 * Sends to every subscriber it can. Inactive Postmark recipients are collected
 * so one bad address doesn't stop the rest of the list; all other failures are
 * thrown immediately. Any collected failure makes the run fail afterward.
 */
async function sendEmailNotifications(options: {
    frequency: EmailNotificationsFrequency
    dryRun: boolean
    local: boolean
}): Promise<SendFailure[]> {
    const { frequency, dryRun, local } = options
    const d1 = local
        ? createLocalD1Client(LOCAL_D1_DATABASE_NAME)
        : createRemoteD1Client()

    const subscribers = await fetchSubscribers(d1, frequency)
    if (subscribers.length === 0) return []

    const now = new Date()
    // Fetch content back to the oldest window start of any subscriber (capped
    // at MAX_WINDOW_MS), then filter per subscriber.
    const minWindowStart = new Date(
        Math.max(
            Math.min(
                ...subscribers.map((subscriber) =>
                    getWindowStart(subscriber, now).getTime()
                )
            ),
            now.getTime() - MAX_WINDOW_MS
        )
    )
    const items = await db.knexReadonlyTransaction(
        (trx) => buildNotificationItems(trx, minWindowStart),
        db.TransactionCloseMode.Close
    )

    // Constructed once, and only when we're actually sending.
    const postmarkClient = dryRun ? undefined : createPostmarkClient()

    const failures: SendFailure[] = []
    for (const subscriber of subscribers) {
        const subscriberItems = filterItemsForSubscriber(items, subscriber, now)
        if (subscriberItems.length === 0) {
            console.log(
                `Subscriber skipped because there are no new items userId=${subscriber.userId}`
            )
            continue
        }

        const html = renderNotificationEmail({
            subscriber,
            items: subscriberItems,
            baseUrl: BAKED_BASE_URL,
            // Links in emails must be absolute; the email notifications API
            // is served on the same host as the baked site.
            apiBaseUrl: `${BAKED_BASE_URL}/api/email-notifications`,
        })
        const slugs = subscriberItems.map((item) => item.slug).join(", ")

        if (dryRun) {
            const previewPath = path.join(
                PREVIEW_DIR,
                `user-${subscriber.userId}-${frequency}.html`
            )
            await fs.outputFile(previewPath, html)
            console.log(
                `Email preview written userId=${subscriber.userId} itemCount=${subscriberItems.length} itemSlugs=${JSON.stringify(slugs)} previewPath=${JSON.stringify(previewPath)}`
            )
            continue
        }

        if (!postmarkClient) {
            throw new Error("Postmark client was not initialized")
        }

        // Deliberate ordering: send first, record after. A crash between
        // the two means the next run re-sends this email — a rare
        // duplicate is preferable to the reverse order, where a crash
        // would silently drop the email forever.
        let postmarkMessageId: string
        try {
            postmarkMessageId = await sendViaPostmark(postmarkClient, {
                to: subscriber.email,
                subject: makeNotificationEmailSubject(frequency),
                htmlBody: html,
                metadata: {
                    userId: String(subscriber.userId),
                    frequency,
                },
            })
        } catch (error) {
            if (!(error instanceof Errors.InactiveRecipientsError)) throw error

            // We only send to subscribers who are not suppressed in our
            // local Postmark state, so a refusal means a subscription-change
            // webhook was missed. Leave it visible for manual reconciliation
            // rather than guessing why it was suppressed.
            console.error(
                `Email send refused userId=${subscriber.userId} reason=inactiveRecipient`
            )
            Sentry.captureException(error)
            failures.push({ userId: subscriber.userId, error })
            continue
        }

        await recordSentEmail(
            d1,
            subscriber,
            subscriberItems,
            postmarkMessageId,
            now
        )
        console.log(
            `Email sent userId=${subscriber.userId} itemCount=${subscriberItems.length} itemSlugs=${JSON.stringify(slugs)}`
        )
    }

    if (failures.length > 0) {
        console.error(
            `Email sending failed failureCount=${failures.length} subscriberCount=${subscribers.length} failedUserIds=${failures.map(({ userId }) => userId).join(",")}`
        )
    }
    const inactiveRecipientUserIds = failures
        .filter(({ error }) => error instanceof Errors.InactiveRecipientsError)
        .map(({ userId }) => userId)
    if (inactiveRecipientUserIds.length > 0) {
        console.error(
            `Suppression reconciliation required recipientCount=${inactiveRecipientUserIds.length} userIds=${inactiveRecipientUserIds.join(",")}`
        )
    }
    return failures
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
                const failures = await sendEmailNotifications({
                    frequency,
                    dryRun,
                    local,
                })
                // Exit non-zero so the scheduled Buildkite run alerts if any
                // subscriber failed, including an inactive Postmark recipient.
                if (failures.length > 0) {
                    await Sentry.close()
                    process.exit(1)
                }
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
