import * as z from "zod/mini"
import { LATEST_FEED_TYPE_VALUES, OwidGdocType } from "./gdocTypes/Gdoc.js"

export const EMAIL_NOTIFICATIONS_FREQUENCIES = ["daily", "weekly"] as const

// From address of all email notification emails, used both by the
// subscribe Cloudflare Function (welcome email) and the send job
// (baker/emailNotifications/).
export const EMAIL_NOTIFICATIONS_FROM_ADDRESS =
    "Our World in Data <updates@ourworldindata.org>"

export type EmailNotificationsFrequency =
    (typeof EMAIL_NOTIFICATIONS_FREQUENCIES)[number]

// Lifetime of the magic-link tokens (tokens table). The short expiry is
// cheap because the expired-link page offers to email a fresh link.
export const EMAIL_NOTIFICATIONS_MAGIC_LINK_TTL_MS = 30 * 60 * 1000

// User-facing labels for the subscribe/preferences form and the welcome
// email.
export const EMAIL_NOTIFICATIONS_FREQUENCY_LABELS: Record<
    EmailNotificationsFrequency,
    string
> = {
    daily: "One email a day",
    weekly: "One email a week",
}

export const EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS: Record<
    (typeof LATEST_FEED_TYPE_VALUES)[number],
    string
> = {
    [OwidGdocType.Article]: "Articles",
    [OwidGdocType.DataInsight]: "Data insights",
    [OwidGdocType.Announcement]: "Announcements",
}

// Mirrors the validation in the email-notifications subscribe Cloudflare
// Function (see functions/api/email-notifications/subscribe.ts), which is the
// authoritative place where requests are validated.
export const EmailNotificationsPreferencesTypeObject = z.object({
    // Topic tag names from the topic tag graph. An empty array means the user
    // wants updates across all topics.
    topicTags: z
        .array(z.string().check(z.minLength(1), z.maxLength(100)))
        .check(z.maxLength(64)),
    contentTypes: z
        .array(z.enum(LATEST_FEED_TYPE_VALUES))
        .check(z.minLength(1), z.maxLength(LATEST_FEED_TYPE_VALUES.length)),
    frequency: z.enum(EMAIL_NOTIFICATIONS_FREQUENCIES),
})

export type EmailNotificationsPreferences = z.infer<
    typeof EmailNotificationsPreferencesTypeObject
>

/**
 * Union of two sets of preferences, used when the public subscribe form is
 * submitted for an address that already exists: the form is tokenless, so it
 * may only ever broaden a subscription, never narrow one — otherwise anyone
 * who knows an address could silently strip its preferences.
 * - topicTags: union; an empty array means "all topics", so it wins.
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

export const EmailNotificationsSubscribeRequestTypeObject = z
    .object({
        email: z.email().check(z.maxLength(254)),
        // Preferences for the new notifications system, stored in our own
        // database. Omitted if the user only wants the OWID Brief.
        notifications: z.optional(EmailNotificationsPreferencesTypeObject),
        // The OWID Brief newsletter stays in Mailchimp.
        subscribeToOwidBrief: z.boolean(),
    })
    .check(
        z.refine(
            (request) =>
                request.notifications !== undefined ||
                request.subscribeToOwidBrief,
            "Select email notifications or the OWID Brief newsletter"
        )
    )

export type EmailNotificationsSubscribeRequest = z.infer<
    typeof EmailNotificationsSubscribeRequestTypeObject
>

export interface EmailNotificationsSubscribeResponse {
    ok?: boolean
    error?: string
}

// Request a magic link for updating preferences. Either an email address
// (from the enter-email UI; unknown addresses get the identical response and
// no email — see the request-link function) or a token: the permanent
// per-user token from an email footer link, or an expired magic-link token
// (its resend button).
export const EmailNotificationsRequestLinkRequestTypeObject = z
    .object({
        email: z.optional(z.email().check(z.maxLength(254))),
        token: z.optional(z.string().check(z.minLength(1), z.maxLength(100))),
    })
    .check(
        z.refine(
            (request) => Boolean(request.email) !== Boolean(request.token),
            "Provide either an email or a token"
        )
    )

export type EmailNotificationsRequestLinkRequest = z.infer<
    typeof EmailNotificationsRequestLinkRequestTypeObject
>

// Save from the magic-link preferences page. The magic link itself was the
// proof of inbox control, so changes apply immediately (no second
// confirmation email). `subscribeToOwidBrief` drives the fail-soft Mailchimp
// Brief toggle: omitted when the toggle wasn't shown.
export const EmailNotificationsUpdatePreferencesRequestTypeObject = z
    .object({
        token: z.string().check(z.minLength(1), z.maxLength(100)),
        preferences: z.optional(EmailNotificationsPreferencesTypeObject),
        unsubscribe: z.optional(z.boolean()),
        subscribeToOwidBrief: z.optional(z.boolean()),
    })
    .check(
        z.refine(
            (request) =>
                request.preferences !== undefined ||
                request.unsubscribe === true,
            "Provide preferences or unsubscribe"
        )
    )

export type EmailNotificationsUpdatePreferencesRequest = z.infer<
    typeof EmailNotificationsUpdatePreferencesRequestTypeObject
>

export interface EmailNotificationsPreferencesResponse {
    email?: string
    // null when the user exists but has no preferences row (fail-safe; the
    // page falls back to defaults).
    preferences?: EmailNotificationsPreferences | null
    // "expired" (HTTP 410) drives the expired-magic-link state of the
    // preferences page, which offers to email a new link.
    error?: "expired" | "invalid" | string
}

export interface EmailNotificationsBriefStatusResponse {
    subscribedToOwidBrief?: boolean
    error?: string
}
