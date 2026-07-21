import * as Sentry from "@sentry/cloudflare"
import * as z from "zod/mini"
import {
    EmailNotificationsPreferences,
    EmailNotificationsPreferencesTypeObject,
    EmailNotificationsSubscribeRequestTypeObject,
    EmailNotificationsSubscribeResponse,
    JsonError,
    mergeEmailNotificationsPreferences,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import { sendWelcomeEmail } from "../../_common/emailNotifications.js"
import { upsertOwidBriefSubscription } from "../../_common/mailchimp.js"

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // The Content-Type header is required to allow requests to be sent with a
    // Content-Type of "application/json". This is because "application/json"
    // is not an allowed value for Content-Type to be considered a
    // CORS-safelisted header.
    // - https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header
    "Access-Control-Allow-Headers": "Content-Type",
}

const DEFAULT_HEADERS = {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
}

// This function is called when the request is a preflight request ("OPTIONS").
export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        headers: CORS_HEADERS,
        status: 200,
    })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        // Cloudflare's rate limiting binding is only available to Workers,
        // not Pages, so until we migrate, this API needs to be rate limited
        // with a zone-level WAF rate limiting rule instead. We still honor
        // the binding here so that the code keeps working after the
        // migration.
        await enforceRateLimit(request, env)

        let rawPayload: unknown
        try {
            rawPayload = await request.json()
        } catch {
            throw new JsonError("Malformed JSON payload", 400)
        }

        const { data, error } =
            EmailNotificationsSubscribeRequestTypeObject.safeParse(rawPayload)
        if (!data) {
            throw new JsonError(
                `Invalid subscribe request: ${z.prettifyError(error)}`,
                400
            )
        }

        const email = data.email.trim().toLowerCase()

        if (data.notifications) {
            if (!env.EMAIL_NOTIFICATIONS_DB) {
                throw new JsonError(
                    "Email notifications database is not configured",
                    500
                )
            }
            // Signup is single opt-in: the submission takes effect
            // immediately and the welcome email confirms it. For an address
            // that already exists (whatever its status), the chosen
            // preferences are unioned with the stored ones rather than
            // replacing them — the form is public and tokenless, so a
            // submission may broaden what a subscription covers but never
            // narrow it (only the frequency follows the latest submission);
            // narrowing requires the magic-link preferences page. The
            // welcome email's footer links let the address's owner undo a
            // submission they didn't make. The response is identical whether
            // the email was already known or not, and both branches send
            // exactly one email, so response timing doesn't give the branch
            // away either.
            const db = env.EMAIL_NOTIFICATIONS_DB
            const origin = new URL(request.url).origin
            const user = await findUserByEmail(db, email)
            let userToken: string
            let preferences: EmailNotificationsPreferences
            if (!user) {
                preferences = data.notifications
                userToken = await createSubscribedUser(db, email, preferences)
            } else {
                preferences = await resubscribeUser(
                    db,
                    user,
                    data.notifications
                )
                userToken = user.token
            }
            await sendWelcomeEmail(env, origin, {
                to: email,
                preferences,
                userToken,
            })
        }

        if (data.subscribeToOwidBrief) {
            // The OWID Brief newsletter stays in Mailchimp; Mailchimp runs
            // its own double opt-in for new list members.
            try {
                await upsertOwidBriefSubscription(env, email, true)
            } catch (error) {
                Sentry.captureException(error)
                throw new JsonError(
                    "Failed to subscribe to the OWID Brief newsletter. Please try again later.",
                    500
                )
            }
        }

        const response: EmailNotificationsSubscribeResponse = { ok: true }
        return new Response(JSON.stringify(response), {
            headers: DEFAULT_HEADERS,
            status: 200,
        })
    } catch (error) {
        if (!(error instanceof JsonError) || error.status >= 500) {
            Sentry.captureException(error)
        }
        const response: EmailNotificationsSubscribeResponse = {
            error: stringifyUnknownError(error) ?? "Unknown error",
        }
        return new Response(JSON.stringify(response), {
            headers: DEFAULT_HEADERS,
            status: error instanceof JsonError ? error.status : 500,
        })
    }
}

async function enforceRateLimit(request: Request, env: Env): Promise<void> {
    if (!env.EMAIL_NOTIFICATIONS_RATE_LIMITER) return
    const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown"
    const { success } = await env.EMAIL_NOTIFICATIONS_RATE_LIMITER.limit({
        key: clientIp,
    })
    if (!success) {
        throw new JsonError("Too many requests. Please try again later.", 429)
    }
}

interface EmailNotificationsUser {
    id: number
    token: string
}

async function findUserByEmail(
    db: D1Database,
    email: string
): Promise<EmailNotificationsUser | null> {
    return await db
        .prepare(`SELECT id, token FROM users WHERE email = ?1`)
        .bind(email)
        .first<EmailNotificationsUser>()
}

/**
 * Single opt-in for a never-seen address: create the user as 'subscribed'
 * with the chosen preferences, active immediately. Returns the permanent
 * per-user token for the welcome email's footer links.
 */
async function createSubscribedUser(
    db: D1Database,
    email: string,
    preferences: EmailNotificationsPreferences
): Promise<string> {
    const token = crypto.randomUUID()
    const user = await db
        .prepare(
            `INSERT INTO users (email, token, status)
             VALUES (?1, ?2, 'subscribed')
             RETURNING id`
        )
        .bind(email, token)
        .first<{ id: number }>()
    if (!user) {
        throw new JsonError("Failed to store subscription", 500)
    }
    await db
        .prepare(
            `INSERT INTO notification_preferences
                 (user_id, topic_tags, content_types, frequency)
             VALUES (?1, ?2, ?3, ?4)`
        )
        .bind(
            user.id,
            JSON.stringify(preferences.topicTags),
            JSON.stringify(preferences.contentTypes),
            preferences.frequency
        )
        .run()
    return token
}

/**
 * Re-apply the subscribe form for an existing address: union the submitted
 * preferences with the stored ones and set the user back to 'subscribed'.
 * Returns the merged preferences for the welcome email.
 */
async function resubscribeUser(
    db: D1Database,
    user: EmailNotificationsUser,
    incoming: EmailNotificationsPreferences
): Promise<EmailNotificationsPreferences> {
    const existing = await findPreferences(db, user.id)
    const merged = existing
        ? mergeEmailNotificationsPreferences(existing, incoming)
        : incoming
    await db.batch([
        db
            .prepare(
                `UPDATE users
                 SET status = 'subscribed',
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1`
            )
            .bind(user.id),
        db
            .prepare(
                `INSERT INTO notification_preferences
                     (user_id, topic_tags, content_types, frequency)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (user_id) DO UPDATE SET
                     topic_tags = excluded.topic_tags,
                     content_types = excluded.content_types,
                     frequency = excluded.frequency,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
            )
            .bind(
                user.id,
                JSON.stringify(merged.topicTags),
                JSON.stringify(merged.contentTypes),
                merged.frequency
            ),
    ])
    return merged
}

/**
 * The user's stored preferences, or null if the row is missing or no longer
 * matches the schema (fail-safe: the submitted preferences then apply as-is).
 */
async function findPreferences(
    db: D1Database,
    userId: number
): Promise<EmailNotificationsPreferences | null> {
    const row = await db
        .prepare(
            `SELECT topic_tags, content_types, frequency
             FROM notification_preferences WHERE user_id = ?1`
        )
        .bind(userId)
        .first<{
            topic_tags: string
            content_types: string
            frequency: string
        }>()
    if (!row) return null
    const { data } = EmailNotificationsPreferencesTypeObject.safeParse({
        topicTags: JSON.parse(row.topic_tags),
        contentTypes: JSON.parse(row.content_types),
        frequency: row.frequency,
    })
    return data ?? null
}
