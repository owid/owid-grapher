import * as Sentry from "@sentry/cloudflare"
import * as z from "zod/mini"
import {
    EmailNotificationsPreferences,
    EmailNotificationsPreferencesResponse,
    EmailNotificationsSubscribeResponse,
    EmailNotificationsUpdatePreferencesRequestTypeObject,
    JsonError,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    EmailTokenLookup,
    lookupEmailToken,
    validateEmailNotificationsDatabase,
} from "../../_common/emailNotifications.js"
import { upsertOwidBriefSubscription } from "../../_common/mailchimp.js"
import {
    POSTMARK_BROADCAST_MESSAGE_STREAM,
    POSTMARK_REACTIVATION_USER_MESSAGE,
    PostmarkRecipientReactivationError,
    reactivatePostmarkRecipient,
} from "../../_common/postmarkClient.js"
import { markReactivatedLocally } from "../../_common/postmarkSuppressions.js"

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

const JSON_HEADERS = {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
}

export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, { headers: CORS_HEADERS, status: 200 })
}

/**
 * Data source of the magic-link preferences page: resolves a magic-link token
 * to the user's email and current preferences. 410 for expired tokens drives
 * the page's expired state (which offers to email a new link).
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
        return new Response(JSON.stringify(response), {
            headers: JSON_HEADERS,
            status: 200,
        })
    } catch (error) {
        Sentry.captureException(error)
        return errorResponse(error)
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

        const response: EmailNotificationsSubscribeResponse = { ok: true }
        return new Response(JSON.stringify(response), {
            headers: JSON_HEADERS,
            status: 200,
        })
    } catch (error) {
        if (!(error instanceof JsonError) || error.status >= 500) {
            Sentry.captureException(error)
        }
        return errorResponse(error)
    }
}

function tokenErrorResponse(
    lookup: EmailTokenLookup | { state: "invalid" }
): Response {
    const response: EmailNotificationsPreferencesResponse =
        lookup.state === "expired" ? { error: "expired" } : { error: "invalid" }
    return new Response(JSON.stringify(response), {
        headers: JSON_HEADERS,
        status: lookup.state === "expired" ? 410 : 404,
    })
}

function errorResponse(error: unknown): Response {
    const response: EmailNotificationsPreferencesResponse = {
        error:
            error instanceof PostmarkRecipientReactivationError
                ? POSTMARK_REACTIVATION_USER_MESSAGE
                : (stringifyUnknownError(error) ?? "Unknown error"),
    }
    return new Response(JSON.stringify(response), {
        headers: JSON_HEADERS,
        status: error instanceof JsonError ? error.status : 500,
    })
}
