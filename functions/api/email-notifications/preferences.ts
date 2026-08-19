import * as Sentry from "@sentry/cloudflare"
import * as z from "zod/mini"
import {
    EmailNotificationsPreferences,
    EmailNotificationsPreferencesResponse,
    EmailNotificationsUpdatePreferencesRequestTypeObject,
    JsonError,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    EmailTokenLookup,
    handleJsonError,
    handleOptionsRequest,
    lookupEmailToken,
    makeJsonResponse,
    validateEmailNotificationsDatabase,
} from "../../_common/emailNotifications.js"
import {
    getOwidBriefStatus,
    upsertOwidBriefSubscription,
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
 * to the user's email, current preferences and OWID Brief status. 410 for
 * expired tokens drives the page's expired state (which offers to email a new
 * link). The Brief status comes from Mailchimp fail-soft: if it can't be
 * determined, it is null and the page hides the Brief toggle — D1 preferences
 * are never hostage to Mailchimp availability.
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
                `SELECT users.email, notification_preferences.topicTags,
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
                topicTags: string | null
                contentTypes: string | null
                frequency: string | null
            }>()
        if (!user) return tokenErrorResponse({ state: "invalid" })

        const response: EmailNotificationsPreferencesResponse = {
            email: user.email,
            subscribedToOwidBrief: await getOwidBriefStatus(
                env,
                user.email
            ).catch((error) => {
                Sentry.captureException(error)
                return null
            }),
            // Fail-safe: a user should always have preferences, but if the
            // row is missing the page falls back to defaults.
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
        return handleJsonError(error)
    }
}

/**
 * Save target of the magic-link preferences page. The magic link itself was
 * the proof of inbox control, so changes apply immediately — including
 * reactivating an unsubscribed user. `unsubscribe: true` unsubscribes
 * instead. An optional `subscribeToOwidBrief` updates the Mailchimp Brief
 * interest fail-soft: a Mailchimp failure never blocks the D1 save.
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

        if (data.unsubscribe) {
            await db
                .prepare(
                    `UPDATE users
                     SET status = 'unsubscribed',
                         updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                     WHERE id = ?1`
                )
                .bind(userId)
                .run()
        } else if (data.preferences) {
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
                         SET status = 'subscribed',
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
                        JSON.stringify(data.preferences.topicTags),
                        JSON.stringify(data.preferences.contentTypes),
                        data.preferences.frequency
                    ),
            ])
        }

        if (data.subscribeToOwidBrief !== undefined) {
            try {
                await upsertOwidBriefSubscription(
                    env,
                    user.email,
                    data.subscribeToOwidBrief
                )
            } catch (error) {
                // Fail soft: the D1 preferences are saved; only the Brief
                // toggle didn't stick.
                const errorMessage =
                    error instanceof Error ? error.message : String(error)
                console.error(
                    `OWID Brief update failed error=${JSON.stringify(errorMessage)}`
                )
                Sentry.captureException(error)
            }
        }

        return makeJsonResponse({ ok: true }, 200)
    } catch (error) {
        if (error instanceof PostmarkRecipientReactivationError) {
            Sentry.captureException(error)
            return makeJsonResponse(
                { error: POSTMARK_REACTIVATION_USER_MESSAGE },
                500
            )
        }
        return handleJsonError(error)
    }
}

function tokenErrorResponse(
    lookup: EmailTokenLookup | { state: "invalid" }
): Response {
    return lookup.state === "expired"
        ? makeJsonResponse({ error: "expired" }, 410)
        : makeJsonResponse({ error: "invalid" }, 404)
}
