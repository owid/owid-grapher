import {
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
    EnrichedBlockText,
    OwidEnrichedGdocBlock,
    LatestType,
} from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import * as _ from "lodash-es"

export interface EmailNotificationsSubscriber {
    userId: number
    email: string
    token: string
    // Topic tag names the user subscribed to; empty means all topics.
    topicTags: string[]
    contentTypes: EmailNotificationsContentType[]
    frequency: EmailNotificationsFrequency
    lastSentAt: Date | null
}

/** Row shape returned by the subscribers query against D1. */
export interface D1SubscriberRow {
    userId: number
    email: string
    token: string
    topicTags: string
    contentTypes: string
    frequency: string
    lastSentAt: string | null
}

export interface NotificationEmailItem {
    // The content type subscribers opt into. Several latest types fold into
    // one of these (a topic update counts as an article).
    type: EmailNotificationsContentType
    // The /latest type, which decides the item's kicker and layout.
    latestType: LatestType
    slug: string
    title: string
    url: string
    publishedAt: Date
    // All topic tag names of the item, including ancestors from the topic tag
    // hierarchy, so that subscriptions to top-level areas (e.g. "Health")
    // match items tagged with finer-grained topics (e.g. "Vaccination").
    topicNames: string[]
    // The most specific tag of the item, shown in the item kicker.
    topicLabel?: string
    authors: string[]
    excerpt?: string
    // An article's authored `latest-feed-excerpt`
    excerptBlocks?: EnrichedBlockText[]
    thumbnailUrl?: string
    // Data insights carry their full content, rendered inline in the email.
    body?: OwidEnrichedGdocBlock[]
    // Cloudflare image URLs for the image blocks in `body`.
    imageUrlsByFilename?: Record<string, string>
}

const DAY_MS = 24 * 60 * 60 * 1000

export const FREQUENCY_WINDOW_MS: Record<EmailNotificationsFrequency, number> =
    {
        daily: DAY_MS,
        weekly: 7 * DAY_MS,
    }

export function parseSubscriberRow(
    row: D1SubscriberRow
): EmailNotificationsSubscriber {
    return {
        userId: row.userId,
        email: row.email,
        token: row.token,
        topicTags: JSON.parse(row.topicTags) as string[],
        contentTypes: JSON.parse(
            row.contentTypes
        ) as EmailNotificationsContentType[],
        frequency: row.frequency as EmailNotificationsFrequency,
        lastSentAt: row.lastSentAt ? new Date(row.lastSentAt) : null,
    }
}

/**
 * The start of the window of new content to include in a subscriber's email:
 * everything since the last email they received, or (for their first email)
 * one frequency interval back.
 */
export function getWindowStart(
    subscriber: EmailNotificationsSubscriber,
    now: Date
): Date {
    return (
        subscriber.lastSentAt ??
        new Date(now.getTime() - FREQUENCY_WINDOW_MS[subscriber.frequency])
    )
}

/**
 * The date shown in an item's kicker. Absolute rather than relative
 * ("yesterday"), because an email may be read days after it was sent. The
 * year is only shown when it differs from the send year, which happens in
 * January for content from the tail of the previous year.
 */
export function formatItemDate(publishedAt: Date, now: Date): string {
    const published = dayjs.utc(publishedAt)
    const format =
        published.year() === dayjs.utc(now).year() ? "MMMM D" : "MMMM D, YYYY"
    return published.format(format)
}

export function filterItemsForSubscriber(
    items: NotificationEmailItem[],
    subscriber: EmailNotificationsSubscriber,
    now: Date
): NotificationEmailItem[] {
    const windowStart = getWindowStart(subscriber, now)
    return items.filter((item) => {
        if (item.publishedAt <= windowStart || item.publishedAt > now)
            return false
        if (!subscriber.contentTypes.includes(item.type)) return false
        // Announcements are news about Our World in Data itself and are
        // usually untagged, so they are not topic-filtered.
        if (item.type === "announcement") return true
        // An empty topicTags array means "all topics".
        if (subscriber.topicTags.length === 0) return true
        return item.topicNames.some((name) =>
            subscriber.topicTags.includes(name)
        )
    })
}

export interface NotificationEmailGroup {
    items: NotificationEmailItem[]
    subscribers: EmailNotificationsSubscriber[]
}

/**
 * Group subscribers who get exactly the same items, so each group's email is
 * rendered once and sent in Postmark bulk requests. Subscribers with no new
 * items are left out.
 */
export function groupSubscribersByItems(
    items: NotificationEmailItem[],
    subscribers: EmailNotificationsSubscriber[],
    now: Date
): NotificationEmailGroup[] {
    const groups = new Map<string, NotificationEmailGroup>()
    for (const subscriber of subscribers) {
        const subscriberItems = filterItemsForSubscriber(items, subscriber, now)
        if (subscriberItems.length === 0) continue
        // Items keep the order of the items list, so equal sets have equal
        // keys.
        const key = JSON.stringify(subscriberItems.map((item) => item.slug))
        const group = groups.get(key)
        if (group) group.subscribers.push(subscriber)
        else
            groups.set(key, {
                items: subscriberItems,
                subscribers: [subscriber],
            })
    }
    return [...groups.values()]
}

/**
 * Fill in top-level {{var}} (HTML-escaped) and {{{var}}} (raw) placeholders
 * the way Postmark's Mustachio templating does, for previewing bulk emails
 * locally. Only covers the subset of Mustachio our templates use.
 */
export function fillPostmarkTemplate(
    template: string,
    model: Record<string, unknown>
): string {
    return template.replace(
        /\{\{\{\s*(\w+)\s*\}\}\}|\{\{\s*(\w+)\s*\}\}/g,
        (_match, rawName?: string, escapedName?: string) => {
            const value = String(model[rawName ?? escapedName ?? ""] ?? "")
            return rawName !== undefined ? value : _.escape(value)
        }
    )
}

// Delivery webhooks for a send normally arrive within minutes.
const WEBHOOK_SILENCE_THRESHOLD_MS = 60 * 60 * 1000

/**
 * Whether Postmark webhooks seem to have stopped reaching us: the last send
 * was long enough ago for its Delivery webhooks to have arrived, but none
 * have been received since. Catches every cause, e.g. a webhook secret that
 * no longer matches, or the webhook being removed in Postmark.
 */
export function areWebhooksMissing({
    lastSentAt,
    lastWebhookAt,
    now,
}: {
    lastSentAt: Date | null
    lastWebhookAt: Date | null
    now: Date
}): boolean {
    if (!lastSentAt) return false
    if (now.getTime() - lastSentAt.getTime() < WEBHOOK_SILENCE_THRESHOLD_MS)
        return false
    return !lastWebhookAt || lastWebhookAt < lastSentAt
}
