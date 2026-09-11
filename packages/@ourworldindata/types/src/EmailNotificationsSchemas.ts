import * as z from "zod/mini"
import { TOPIC_AREA_NAMES } from "./domainTypes/ContentGraph.js"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPES,
    EMAIL_NOTIFICATIONS_FREQUENCIES,
} from "./EmailNotificationsTypes.js"

export const EmailNotificationsPreferencesTypeObject = z.object({
    // An empty array means "all topics".
    topicTags: z
        .array(z.enum(TOPIC_AREA_NAMES))
        .check(z.maxLength(TOPIC_AREA_NAMES.length)),
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
        captchaToken: z.string().check(z.minLength(1), z.maxLength(2048)),
        website: z.optional(z.string().check(z.maxLength(2048))),
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

const EmailNotificationsPreferencesToken = z
    .string()
    .check(z.minLength(1), z.maxLength(100))

const EmailNotificationsUpdatePreferencesCommonShape = {
    action: z.literal("updatePreferences"),
    token: EmailNotificationsPreferencesToken,
    subscribeToOwidBrief: z.optional(z.boolean()),
}

export const EmailNotificationsUpdatePreferencesRequestTypeObject =
    z.discriminatedUnion("action", [
        z.strictObject({
            action: z.literal("unsubscribeAll"),
            token: EmailNotificationsPreferencesToken,
        }),
        z.discriminatedUnion("subscribeToTopicNotifications", [
            z.strictObject({
                ...EmailNotificationsUpdatePreferencesCommonShape,
                subscribeToTopicNotifications: z.literal(true),
                preferences: EmailNotificationsPreferencesTypeObject,
            }),
            z.strictObject({
                ...EmailNotificationsUpdatePreferencesCommonShape,
                subscribeToTopicNotifications: z.literal(false),
                preferences: z.optional(z.never()),
            }),
        ]),
    ])

export type EmailNotificationsUpdatePreferencesRequest = z.infer<
    typeof EmailNotificationsUpdatePreferencesRequestTypeObject
>
