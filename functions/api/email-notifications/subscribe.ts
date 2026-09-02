import * as z from "zod/mini"
import {
    EmailNotificationsPreferences,
    JsonError,
    mergeEmailNotificationsPreferences,
} from "@ourworldindata/utils"
import { EmailNotificationsSubscribeRequestTypeObject } from "@ourworldindata/types/email-notifications-schemas"
import { Env } from "../../_common/env.js"
import {
    handleJsonError,
    handleOptionsRequest,
    makeJsonResponse,
    sendWelcomeEmail,
    validateEmailNotificationsDatabase,
} from "../../_common/emailNotifications.js"
import { logErrorAndCaptureInSentry } from "../../_common/errorLog.js"
import { enableOwidBriefSubscriptionForAudienceMember } from "../../_common/mailchimp.js"
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
        validateEmailNotificationsDatabase(env)
        const db = env.EMAIL_NOTIFICATIONS_DB
        // Every subscriber gets a D1 identity so the magic-link preferences
        // page can manage both products. A Brief-only identity has email
        // notifications disabled and no notification preferences row.
        const user = await ensureUserIdentity(db, email)

        if (data.notifications) {
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
            const origin = new URL(request.url).origin
            const postmarkSuppression = await findLocalSuppressionState(
                db,
                email
            )
            if (postmarkSuppression?.isSuppressed) {
                await reactivatePostmarkRecipient(env, email)
                await markReactivatedLocally(
                    db,
                    email,
                    postmarkSuppression.postmarkChangedAt
                )
            }
            const preferences = await resubscribeUser(
                db,
                user,
                data.notifications
            )
            await sendWelcomeEmail(env, origin, {
                userId: user.id,
                to: email,
                preferences,
                userToken: user.token,
            })
        }

        const mailchimpSignupRequired = data.subscribeToOwidBrief
            ? !(await enableOwidBriefSubscriptionForAudienceMember(env, email))
            : false

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
                "Failed to reactivate a Postmark recipient while subscribing",
                error
            )
            return makeJsonResponse(
                { error: POSTMARK_REACTIVATION_USER_MESSAGE },
                500
            )
        }
        return handleJsonError(
            error,
            "Failed to handle an email notifications subscription"
        )
    }
}

interface EmailNotificationsUser {
    id: number
    email: string
    token: string
}

async function ensureUserIdentity(
    db: D1Database,
    email: string
): Promise<EmailNotificationsUser> {
    await db
        .prepare(
            `INSERT OR IGNORE INTO users
                 (email, token, emailNotificationsStatus)
             VALUES (?1, ?2, 'unsubscribed')`
        )
        .bind(email, crypto.randomUUID())
        .run()
    const user = await db
        .prepare(`SELECT id, email, token FROM users WHERE email = ?1`)
        .bind(email)
        .first<EmailNotificationsUser>()
    if (!user) {
        throw new JsonError("Failed to store subscriber identity", 500)
    }
    return user
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
                 SET emailNotificationsStatus = 'subscribed',
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
 * The user's stored preferences, or null if the row is missing.
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
    return {
        topicTags: JSON.parse(
            row.topicTags
        ) as EmailNotificationsPreferences["topicTags"],
        contentTypes: JSON.parse(
            row.contentTypes
        ) as EmailNotificationsPreferences["contentTypes"],
        frequency: row.frequency as EmailNotificationsPreferences["frequency"],
    }
}
