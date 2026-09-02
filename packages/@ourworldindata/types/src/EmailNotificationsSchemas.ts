import * as z from "zod/mini"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPES,
    EMAIL_NOTIFICATIONS_FREQUENCIES,
} from "./EmailNotificationsTypes.js"

export const EmailNotificationsPreferencesTypeObject = z.object({
    topicTags: z
        .array(z.string().check(z.minLength(1), z.maxLength(100)))
        .check(z.maxLength(64)),
    contentTypes: z
        .array(z.enum(EMAIL_NOTIFICATIONS_CONTENT_TYPES))
        .check(
            z.minLength(1),
            z.maxLength(EMAIL_NOTIFICATIONS_CONTENT_TYPES.length)
        ),
    frequency: z.enum(EMAIL_NOTIFICATIONS_FREQUENCIES),
})

export type EmailNotificationsPreferences = z.infer<
    typeof EmailNotificationsPreferencesTypeObject
>

export const EmailNotificationsSubscribeRequestTypeObject = z
    .object({
        email: z.email().check(z.maxLength(254)),
        notifications: z.optional(EmailNotificationsPreferencesTypeObject),
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

const EmailNotificationsUpdatePreferencesCommonShape = {
    token: z.string().check(z.minLength(1), z.maxLength(100)),
    subscribeToOwidBrief: z.optional(z.boolean()),
}

export const EmailNotificationsUpdatePreferencesRequestTypeObject =
    z.discriminatedUnion("subscribeToTopicNotifications", [
        z.object({
            ...EmailNotificationsUpdatePreferencesCommonShape,
            subscribeToTopicNotifications: z.literal(true),
            preferences: EmailNotificationsPreferencesTypeObject,
        }),
        z.object({
            ...EmailNotificationsUpdatePreferencesCommonShape,
            subscribeToTopicNotifications: z.literal(false),
            preferences: z.optional(z.never()),
        }),
    ])

export type EmailNotificationsUpdatePreferencesRequest = z.infer<
    typeof EmailNotificationsUpdatePreferencesRequestTypeObject
>
