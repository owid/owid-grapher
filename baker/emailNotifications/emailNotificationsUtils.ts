import {
    EmailNotificationsFrequency,
    EmailNotificationsPreferencesTypeObject,
    LATEST_FEED_TYPE_VALUES,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"

export type LatestFeedType = (typeof LATEST_FEED_TYPE_VALUES)[number]

export interface EmailNotificationsSubscriber {
    userId: number
    email: string
    token: string
    // Topic tag names the user subscribed to. Empty means "all topics".
    topicTags: string[]
    contentTypes: LatestFeedType[]
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
    type: LatestFeedType
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
    thumbnailUrl?: string
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

export function filterItemsForSubscriber(
    items: NotificationEmailItem[],
    subscriber: EmailNotificationsSubscriber,
    now: Date
): NotificationEmailItem[] {
    const windowStart = getWindowStart(subscriber, now)
    return items.filter(
        (item) =>
            item.publishedAt > windowStart &&
            item.publishedAt <= now &&
            subscriber.contentTypes.includes(item.type) &&
            (subscriber.topicTags.length === 0 ||
                item.topicNames.some((name) =>
                    subscriber.topicTags.includes(name)
                ))
    )
}
