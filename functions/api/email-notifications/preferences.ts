import * as z from "zod/mini"
import {
    EmailNotificationsPreferences,
    EmailNotificationsPreferencesResponse,
    JsonError,
    EmailNotificationsStatus,
} from "@ourworldindata/utils"
import { EmailNotificationsUpdatePreferencesRequestTypeObject } from "@ourworldindata/types/email-notifications-schemas"
import { Env } from "../../_common/env.js"
import {
    EmailTokenLookup,
    handleJsonError,
    handleOptionsRequest,
    lookupEmailToken,
    makeJsonResponse,
    validateEmailNotificationsDatabase,
} from "../../_common/emailNotifications.js"
import { logErrorAndCaptureInSentry } from "../../_common/errorLog.js"
import {
    disableOwidBriefSubscription,
    enableOwidBriefSubscriptionForAudienceMember,
    getOwidBriefStatus,
} from "../../_common/mailchimp.js"
import {
    POSTMARK_BROADCAST_MESSAGE_STREAM,
    POSTMARK_REACTIVATION_USER_MESSAGE,
    PostmarkRecipientReactivationError,
    reactivatePostmarkRecipient,
} from "../../_common/postmarkClient.js"
import { markReactivatedLocally } from "../../_common/postmarkSuppressions.js"

export const onRequestOptions = handleOptionsRequest

/**
 * Data source of the magic-link preferences page: resolves a magic-link token
 * to the user's email, current notification status and preferences, and live
 * OWID Brief status from Mailchimp. 410 for expired tokens drives the page's
 * expired state (which offers to email a new link). If Mailchimp is
 * unavailable, its status is null and that independent control is disabled.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    try {
        validateEmailNotificationsDatabase(env)
        const db = env.EMAIL_NOTIFICATIONS_DB
        const token = new URL(request.url).searchParams.get("token")
        if (!token) return tokenErrorResponse({ state: "invalid" })

        const lookup = await lookupEmailToken(db, token)
        if (lookup.state !== "valid") return tokenErrorResponse(lookup)

        const user = await db
            .prepare(
                `SELECT users.email, users.emailNotificationsStatus,
                        notification_preferences.topicTags,
                        notification_preferences.contentTypes,
                        notification_preferences.frequency
                 FROM users
                 LEFT JOIN notification_preferences
                     ON notification_preferences.userId = users.id
                 WHERE users.id = ?1`
            )
            .bind(lookup.row.userId)
            .first<{
                email: string
                emailNotificationsStatus: EmailNotificationsStatus
                topicTags: string | null
                contentTypes: string | null
                frequency: string | null
            }>()
        if (!user) return tokenErrorResponse({ state: "invalid" })

        const response: EmailNotificationsPreferencesResponse = {
            email: user.email,
            emailNotificationsStatus: user.emailNotificationsStatus,
            subscribedToOwidBrief: await getOwidBriefStatus(
                env,
                user.email
            ).catch((error) => {
                logErrorAndCaptureInSentry(
                    "Failed to load the OWID Brief subscription status",
                    error
                )
                return null
            }),
            // Brief-only identities intentionally have no notification
            // preferences row; the page offers defaults if they enable email
            // notifications.
            preferences:
                user.topicTags && user.contentTypes && user.frequency
                    ? ({
                          topicTags: JSON.parse(user.topicTags),
                          contentTypes: JSON.parse(user.contentTypes),
                          frequency: user.frequency,
                      } as EmailNotificationsPreferences)
                    : null,
        }
        return makeJsonResponse(response, 200)
    } catch (error) {
        return handleJsonError(
            error,
            "Failed to load email notification preferences"
        )
    }
}

/**
 * Save target of the magic-link preferences page. The magic link itself was
 * the proof of inbox control, so changes apply immediately. Notification
 * status and preferences are stored in D1. Brief opt-outs disable the
 * Mailchimp interest directly. Opt-ins update the interest directly for
 * active audience members, while globally unsubscribed or missing contacts
 * return a signal that lets the browser continue through Mailchimp's hosted
 * signup form.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        validateEmailNotificationsDatabase(env)
        const db = env.EMAIL_NOTIFICATIONS_DB

        let rawPayload: unknown
        try {
            rawPayload = await request.json()
        } catch {
            throw new JsonError("Malformed JSON payload", 400)
        }
        const { data, error } =
            EmailNotificationsUpdatePreferencesRequestTypeObject.safeParse(
                rawPayload
            )
        if (!data) {
            throw new JsonError(
                `Invalid request: ${z.prettifyError(error)}`,
                400
            )
        }

        const lookup = await lookupEmailToken(db, data.token)
        if (lookup.state !== "valid") return tokenErrorResponse(lookup)
        const userId = lookup.row.userId
        const user = await db
            .prepare(
                `SELECT users.email,
                        CASE
                            WHEN postmark_suppressions.isSuppressed = 1
                            THEN postmark_suppressions.postmarkChangedAt
                        END AS activeSuppressionChangedAt
                 FROM users
                 LEFT JOIN postmark_suppressions
                     ON postmark_suppressions.email = users.email
                     AND postmark_suppressions.messageStream = ?2
                 WHERE users.id = ?1`
            )
            .bind(userId, POSTMARK_BROADCAST_MESSAGE_STREAM)
            .first<{
                email: string
                activeSuppressionChangedAt: string | null
            }>()
        if (!user) return tokenErrorResponse({ state: "invalid" })

        if (!data.subscribeToTopicNotifications) {
            await db
                .prepare(
                    `UPDATE users
                     SET emailNotificationsStatus = 'unsubscribed',
                         updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                     WHERE id = ?1`
                )
                .bind(userId)
                .run()
        } else {
            const preferences = data.preferences
            if (user.activeSuppressionChangedAt) {
                await reactivatePostmarkRecipient(env, user.email)
                await markReactivatedLocally(
                    db,
                    user.email,
                    user.activeSuppressionChangedAt
                )
            }
            await db.batch([
                db
                    .prepare(
                        `UPDATE users
                         SET emailNotificationsStatus = 'subscribed',
                             updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                         WHERE id = ?1`
                    )
                    .bind(userId),
                db
                    .prepare(
                        `INSERT INTO notification_preferences
                             (userId, topicTags, contentTypes, frequency)
                         VALUES (?1, ?2, ?3, ?4)
                         ON CONFLICT (userId) DO UPDATE SET
                             topicTags = excluded.topicTags,
                             contentTypes = excluded.contentTypes,
                             frequency = excluded.frequency,
                             updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
                    )
                    .bind(
                        userId,
                        JSON.stringify(preferences.topicTags),
                        JSON.stringify(preferences.contentTypes),
                        preferences.frequency
                    ),
            ])
        }

        let mailchimpSignupRequired = false
        if (data.subscribeToOwidBrief === false) {
            await disableOwidBriefSubscription(env, user.email)
        } else if (data.subscribeToOwidBrief === true) {
            mailchimpSignupRequired =
                !(await enableOwidBriefSubscriptionForAudienceMember(
                    env,
                    user.email
                ))
        }

        return makeJsonResponse(
            {
                ok: true,
                mailchimpSignupRequired,
            },
            200
        )
    } catch (error) {
        if (error instanceof PostmarkRecipientReactivationError) {
            logErrorAndCaptureInSentry(
                "Failed to reactivate a Postmark recipient while saving preferences",
                error
            )
            return makeJsonResponse(
                { error: POSTMARK_REACTIVATION_USER_MESSAGE },
                500
            )
        }
        return handleJsonError(
            error,
            "Failed to save email notification preferences"
        )
    }
}

function tokenErrorResponse(
    lookup: EmailTokenLookup | { state: "invalid" }
): Response {
    return lookup.state === "expired"
        ? makeJsonResponse({ error: "expired" }, 410)
        : makeJsonResponse({ error: "invalid" }, 404)
}
