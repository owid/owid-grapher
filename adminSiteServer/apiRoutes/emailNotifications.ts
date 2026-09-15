import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPES,
    EMAIL_NOTIFICATIONS_FREQUENCIES,
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
} from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import * as db from "../../db/db.js"
import { Request } from "../authentication.js"
import { HandlerResponse } from "../FunctionalRouter.js"
import { BAKED_BASE_URL } from "../../settings/serverSettings.js"
import { buildNotificationItems } from "../../baker/emailNotifications/notificationItems.js"
import { renderNotificationEmail } from "../../baker/emailNotifications/NotificationEmail.js"
import {
    FREQUENCY_WINDOW_MS,
    filterItemsForSubscriber,
} from "../../baker/emailNotifications/emailNotificationsUtils.js"

// Backs the admin's email notification preview page. The preview renders the
// same template the send job uses, from real published content, for a mock
// subscriber whose preferences the page's form controls.

/** The topics a subscriber can choose from — the areas of the topic tag graph. */
export async function getEmailNotificationsPreviewTopics(
    _req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    return { topicTags: await db.getTopicAreaNames(trx) }
}

/**
 * The moment the mock send happens: the end of the requested day (UTC), so
 * content published earlier that day is included. Defaults to today.
 */
function parseSentAt(value: unknown): Date {
    const day =
        typeof value === "string" ? dayjs.utc(value, "YYYY-MM-DD") : null
    return (day?.isValid() ? day : dayjs.utc()).endOf("day").toDate()
}

/** Repeated query params arrive as string[], single ones as string. */
function parseList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String)
    if (typeof value === "string" && value !== "") return value.split(",")
    return []
}

export async function getEmailNotificationsPreview(
    req: Request,
    _res: HandlerResponse,
    trx: db.KnexReadonlyTransaction
) {
    const sentAt = parseSentAt(req.query.sentAt)
    const frequency = EMAIL_NOTIFICATIONS_FREQUENCIES.includes(
        req.query.frequency as EmailNotificationsFrequency
    )
        ? (req.query.frequency as EmailNotificationsFrequency)
        : "weekly"
    const requestedContentTypes = parseList(
        req.query.contentTypes
    ) as EmailNotificationsContentType[]
    const contentTypes = requestedContentTypes.filter((contentType) =>
        EMAIL_NOTIFICATIONS_CONTENT_TYPES.includes(contentType)
    )
    // An empty topicTags array means "all topics", matching the real
    // subscriber semantics.
    const topicTags = parseList(req.query.topicTags)
    const email =
        typeof req.query.email === "string" && req.query.email
            ? req.query.email
            : "preview@ourworldindata.org"

    // A subscriber's window is their cadence, so it follows from the send
    // date and frequency rather than being set independently. lastSentAt is
    // left null so filterItemsForSubscriber derives the same window itself,
    // exactly as it does for a subscriber's first email.
    const windowStart = new Date(
        sentAt.getTime() - FREQUENCY_WINDOW_MS[frequency]
    )
    const allItems = await buildNotificationItems(trx, windowStart)

    const subscriber = {
        userId: 0,
        email,
        token: "preview-token",
        topicTags,
        contentTypes,
        frequency,
        lastSentAt: null,
    }
    const items = filterItemsForSubscriber(allItems, subscriber, sentAt)

    const { html, text } = await renderNotificationEmail({
        subscriber,
        items,
        baseUrl: BAKED_BASE_URL,
        apiBaseUrl: `${BAKED_BASE_URL}/api/email-notifications`,
        now: sentAt,
    })

    return {
        html,
        text,
        itemCount: items.length,
        // How many items were published in the window before the mock
        // subscriber's preferences filtered them, so it's clear whether an
        // empty preview means "nothing published" or "nothing matched".
        publishedInWindowCount: allItems.length,
        htmlBytes: Buffer.byteLength(html),
        windowStart: windowStart.toISOString(),
    }
}
