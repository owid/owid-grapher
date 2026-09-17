import type { LatestType } from "./domainTypes/Latest.js"
import type { EmailNotificationsPreferences } from "./EmailNotificationsSchemas.js"

export type {
    EmailNotificationsPreferences,
    EmailNotificationsRequestLinkRequest,
    EmailNotificationsSubscribeRequest,
    EmailNotificationsUpdatePreferencesRequest,
} from "./EmailNotificationsSchemas.js"

export const EMAIL_NOTIFICATIONS_FREQUENCIES = ["daily", "weekly"] as const

// From address of all email notification emails, used both by the
// subscribe Cloudflare Function (welcome email) and the send job
// (baker/emailNotifications/).
export const EMAIL_NOTIFICATIONS_FROM_ADDRESS =
    "Our World in Data <updates@ourworldindata.org>"

export type EmailNotificationsFrequency =
    (typeof EMAIL_NOTIFICATIONS_FREQUENCIES)[number]

export const EMAIL_NOTIFICATIONS_STATUSES = [
    "subscribed",
    "unsubscribed",
] as const

export type EmailNotificationsStatus =
    (typeof EMAIL_NOTIFICATIONS_STATUSES)[number]

// Lifetime of the magic-link tokens (tokens table). The short expiry is
// cheap because the expired-link page offers to email a fresh link.
export const EMAIL_NOTIFICATIONS_MAGIC_LINK_TTL_MS = 30 * 60 * 1000

// User-facing labels for the subscription and preferences forms and the
// welcome email.
export const EMAIL_NOTIFICATIONS_FREQUENCY_LABELS: Record<
    EmailNotificationsFrequency,
    string
> = {
    daily: "One email a day",
    weekly: "One email a week",
}

/**
 * The content-type dimension of a notification subscription. Mostly mirrors
 * the gdoc types of the latest feed, except announcement gdocs are split by
 * their kicker: "data-update" / "topic-update" kickers are topic-tagged
 * content updates and ship under "data-update", while "announcement" /
 * "website-upgrade" kickers are news about Our World in Data itself —
 * usually untagged, so the "announcement" content type is topic-independent.
 */
export const EMAIL_NOTIFICATIONS_CONTENT_TYPES = [
    "article",
    "data-insight",
    "data-update",
    "announcement",
] as const

export type EmailNotificationsContentType =
    (typeof EMAIL_NOTIFICATIONS_CONTENT_TYPES)[number]

/** Which subscription content type an item's LatestType falls under. */
export const EMAIL_NOTIFICATIONS_CONTENT_TYPE_BY_LATEST_TYPE: Record<
    LatestType,
    EmailNotificationsContentType
> = {
    article: "article",
    "data-insight": "data-insight",
    "data-update": "data-update",
    "topic-update": "data-update",
    "website-upgrade": "announcement",
    announcement: "announcement",
}

export const EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS: Record<
    EmailNotificationsContentType,
    string
> = {
    article: "Articles",
    "data-insight": "Data insights",
    "data-update": "Data updates",
    announcement: "Announcements",
}

/**
 * Union of two sets of preferences, used when the public subscribe form is
 * submitted for an address that already exists: the form is tokenless, so it
 * may only ever broaden a subscription, never narrow one — otherwise anyone
 * who knows an address could silently strip its preferences.
 * - topicTags: union, where an empty array means "all topics" and therefore
 *   absorbs everything — if either side is empty, the result is empty.
 * - contentTypes: union.
 * - frequency: the incoming one — cadence is a setting, not subscription
 *   scope, so the form's explicit choice wins.
 */
export function mergeEmailNotificationsPreferences(
    existing: EmailNotificationsPreferences,
    incoming: EmailNotificationsPreferences
): EmailNotificationsPreferences {
    return {
        topicTags:
            existing.topicTags.length === 0 || incoming.topicTags.length === 0
                ? []
                : [...new Set([...existing.topicTags, ...incoming.topicTags])],
        contentTypes: [
            ...new Set([...existing.contentTypes, ...incoming.contentTypes]),
        ],
        frequency: incoming.frequency,
    }
}

/** Whether the opt-in is active or awaits Mailchimp confirmation. */
export type OwidBriefOptInResult = "active" | "pending"

export interface EmailNotificationsSubscribeResponse {
    ok?: boolean
    error?: string
}

export interface EmailNotificationsUpdatePreferencesResponse {
    ok?: boolean
    owidBriefOptIn?: OwidBriefOptInResult
    error?: string
}

export interface EmailNotificationsPreferencesResponse {
    email?: string
    emailNotificationsStatus?: EmailNotificationsStatus
    // null when the identity has never configured notification preferences.
    // The page uses defaults if the reader chooses to enable notifications.
    preferences?: EmailNotificationsPreferences | null
    // Whether the user is subscribed to the OWID Brief in Mailchimp; null when
    // that can't be determined (Mailchimp unavailable or unconfigured), in
    // which case the page disables Brief changes and explains why.
    subscribedToOwidBrief?: boolean | null
    // "expired" (HTTP 410) drives the expired-magic-link state of the
    // preferences page, which offers to email a new link.
    error?: "expired" | "invalid" | string
}
