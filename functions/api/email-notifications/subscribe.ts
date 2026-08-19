import * as Sentry from "@sentry/cloudflare"
import * as z from "zod/mini"
import {
    EmailNotificationsPreferences,
    EmailNotificationsPreferencesTypeObject,
    EmailNotificationsSubscribeRequestTypeObject,
    JsonError,
    mergeEmailNotificationsPreferences,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    handleJsonError,
    handleOptionsRequest,
    makeJsonResponse,
    sendWelcomeEmail,
    validateEmailNotificationsDatabase,
} from "../../_common/emailNotifications.js"
import { upsertOwidBriefSubscription } from "../../_common/mailchimp.js"
import {
    POSTMARK_REACTIVATION_USER_MESSAGE,
    PostmarkRecipientReactivationError,
    reactivatePostmarkRecipient,
} from "../../_common/postmarkClient.js"
import {
    findLocalSuppressionState,
    markReactivatedLocally,
} from "../../_common/postmarkSuppressions.js"

export const onRequestOptions = handleOptionsRequest

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
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
            validateEmailNotificationsDatabase(env)
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
            // exactly one email.
            const db = env.EMAIL_NOTIFICATIONS_DB
            const origin = new URL(request.url).origin
            const [user, postmarkSuppression] = await Promise.all([
                findUserByEmail(db, email),
                findLocalSuppressionState(db, email),
            ])
            if (postmarkSuppression?.isSuppressed) {
                await reactivatePostmarkRecipient(env, email)
                await markReactivatedLocally(
                    db,
                    email,
                    postmarkSuppression.postmarkChangedAt
                )
            }
            let userId: number
            let userToken: string
            let preferences: EmailNotificationsPreferences
            if (!user) {
                preferences = data.notifications
                const createdUser = await createSubscribedUser(
                    db,
                    email,
                    preferences
                )
                userId = createdUser.id
                userToken = createdUser.token
            } else {
                preferences = await resubscribeUser(
                    db,
                    user,
                    data.notifications
                )
                userId = user.id
                userToken = user.token
            }
            await sendWelcomeEmail(env, origin, {
                userId,
                to: email,
                preferences,
                userToken,
            })
        }

        if (data.subscribeToOwidBrief) {
            // The OWID Brief newsletter stays in Mailchimp and uses single
            // opt-in, like email notifications.
            await upsertOwidBriefSubscription(env, email, true)
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

interface EmailNotificationsUser {
    id: number
    email: string
    token: string
}

async function findUserByEmail(
    db: D1Database,
    email: string
): Promise<EmailNotificationsUser | null> {
    return await db
        .prepare(`SELECT id, email, token FROM users WHERE email = ?1`)
        .bind(email)
        .first<EmailNotificationsUser>()
}

/**
 * Single opt-in for a never-seen address: create the user as 'subscribed'
 * with the chosen preferences, active immediately.
 */
async function createSubscribedUser(
    db: D1Database,
    email: string,
    preferences: EmailNotificationsPreferences
): Promise<EmailNotificationsUser> {
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
                 (userId, topicTags, contentTypes, frequency)
             VALUES (?1, ?2, ?3, ?4)`
        )
        .bind(
            user.id,
            JSON.stringify(preferences.topicTags),
            JSON.stringify(preferences.contentTypes),
            preferences.frequency
        )
        .run()
    return { id: user.id, email, token }
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
                     updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1`
            )
            .bind(user.id),
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
            `SELECT topicTags, contentTypes, frequency
             FROM notification_preferences WHERE userId = ?1`
        )
        .bind(userId)
        .first<{
            topicTags: string
            contentTypes: string
            frequency: string
        }>()
    if (!row) return null
    const { data } = EmailNotificationsPreferencesTypeObject.safeParse({
        topicTags: JSON.parse(row.topicTags),
        contentTypes: JSON.parse(row.contentTypes),
        frequency: row.frequency,
    })
    return data ?? null
}
