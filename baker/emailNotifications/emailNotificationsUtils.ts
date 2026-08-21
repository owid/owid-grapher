import {
    EmailNotificationsContentType,
    EmailNotificationsFrequency,
    EmailNotificationsPreferencesTypeObject,
    EnrichedBlockText,
    OwidEnrichedGdocBlock,
    LatestType,
} from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"

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
    user_id: number
    email: string
    token: string
    topic_tags: string
    content_types: string
    frequency: string
    last_sent_at: string | null
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
    // An article's authored `latest-feed-excerpt`, used in preference to the
    // plain-text `excerpt` when set. Several paragraphs, so it's kept as
    // blocks rather than a string.
    excerptBlocks?: EnrichedBlockText[]
    thumbnailUrl?: string
    // An announcement written as a single call to action (a top-level {.cta}
    // and no body) links out with its own wording.
    cta?: { text: string; url: string }
    // Data insights carry their full content, rendered inline in the email.
    body?: OwidEnrichedGdocBlock[]
    // Cloudflare image URLs for the image blocks in `body`.
    imageUrlByFilename?: Record<string, string>
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
    const preferences = EmailNotificationsPreferencesTypeObject.parse({
        topicTags: JSON.parse(row.topic_tags),
        contentTypes: JSON.parse(row.content_types),
        frequency: row.frequency,
    })
    return {
        userId: row.user_id,
        email: row.email,
        token: row.token,
        topicTags: preferences.topicTags,
        contentTypes: preferences.contentTypes,
        frequency: preferences.frequency,
        lastSentAt: row.last_sent_at ? new Date(row.last_sent_at) : null,
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
