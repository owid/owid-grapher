import * as Sentry from "@sentry/cloudflare"
import { EmailNotificationsPreferencesTypeObject } from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    EmailTokenRow,
    consumeEmailToken,
    escapeHtml,
    lookupEmailToken,
    makeHtmlResponse,
    renderActionPage,
    renderMessagePage,
} from "../../_common/emailNotifications.js"

const CONFIRM_PATH = "/api/email-notifications/confirm"
const RESEND_PATH = "/api/email-notifications/resend-confirmation"

/**
 * Confirm link target from the confirmation emails. Renders a page whose
 * button POSTs back here — the state change must not happen on GET, because
 * mail security scanners prefetch links in emails.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const db = env.EMAIL_NOTIFICATIONS_DB
        const token = new URL(request.url).searchParams.get("token")
        if (!token || !db) return invalidLinkResponse()

        const lookup = await lookupEmailToken(db, token, "confirm")
        switch (lookup.state) {
            case "valid": {
                const email = await getUserEmail(db, lookup.row.user_id)
                return makeHtmlResponse(
                    renderActionPage({
                        title: "Confirm your subscription",
                        message: `Click below to apply the notification preferences you chose${email ? ` for ${escapeHtml(email)}` : ""}.`,
                        button: {
                            label: "Confirm",
                            action: CONFIRM_PATH,
                            token: lookup.row.token,
                        },
                    })
                )
            }
            case "expired":
                return expiredLinkResponse(lookup.row)
            case "consumed":
                return alreadyConfirmedResponse()
            case "invalid":
                return invalidLinkResponse()
        }
    } catch (error) {
        Sentry.captureException(error)
        return errorResponse()
    }
}

/**
 * Form target of the confirm page's button. Consumes the token and applies
 * the preferences it carries: a new user becomes subscribed, an existing
 * user's preferences are replaced, an unsubscribed user is reactivated.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const db = env.EMAIL_NOTIFICATIONS_DB
        const formData = await request.formData().catch(() => null)
        const token = formData?.get("token")
        if (typeof token !== "string" || !token || !db)
            return invalidLinkResponse()

        const lookup = await lookupEmailToken(db, token, "confirm")
        switch (lookup.state) {
            case "valid": {
                const claimed = await consumeEmailToken(db, lookup.row.id)
                // Double-submitted form: the first submission won.
                if (!claimed) return alreadyConfirmedResponse()
                await applyConfirmedPreferences(db, lookup.row)
                return makeHtmlResponse(
                    renderMessagePage({
                        title: "You're subscribed!",
                        message:
                            "Your email notification preferences have been saved. You'll receive an email when we publish new work matching them.",
                    })
                )
            }
            case "expired":
                return expiredLinkResponse(lookup.row)
            case "consumed":
                return alreadyConfirmedResponse()
            case "invalid":
                return invalidLinkResponse()
        }
    } catch (error) {
        Sentry.captureException(error)
        return errorResponse()
    }
}

async function applyConfirmedPreferences(
    db: D1Database,
    tokenRow: EmailTokenRow
): Promise<void> {
    // The payload was validated when the token was created; re-validate in
    // case the schema has changed since.
    const { data: preferences } =
        EmailNotificationsPreferencesTypeObject.safeParse(
            JSON.parse(tokenRow.payload ?? "null")
        )
    if (!preferences) {
        throw new Error(
            `Confirm token ${tokenRow.id} has an invalid preferences payload`
        )
    }
    await db.batch([
        db
            .prepare(
                `UPDATE users
                 SET status = 'subscribed',
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1`
            )
            .bind(tokenRow.user_id),
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
                tokenRow.user_id,
                JSON.stringify(preferences.topicTags),
                JSON.stringify(preferences.contentTypes),
                preferences.frequency
            ),
    ])
}

async function getUserEmail(
    db: D1Database,
    userId: number
): Promise<string | null> {
    const user = await db
        .prepare(`SELECT email FROM users WHERE id = ?1`)
        .bind(userId)
        .first<{ email: string }>()
    return user?.email ?? null
}

function expiredLinkResponse(tokenRow: EmailTokenRow): Response {
    return makeHtmlResponse(
        renderActionPage({
            title: "This confirmation link has expired",
            message:
                "Confirmation links are only valid for 48 hours, but we can send you a fresh one — the preferences you chose are preserved.",
            button: {
                label: "Resend confirmation email",
                action: RESEND_PATH,
                token: tokenRow.token,
            },
        }),
        410
    )
}

function alreadyConfirmedResponse(): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Already confirmed",
            message:
                "This confirmation link has already been used, so there's nothing left to do. You can change your preferences at any time at https://ourworldindata.org/subscribe.",
        })
    )
}

function invalidLinkResponse(): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Invalid confirmation link",
            message:
                "This confirmation link is not valid. Please use the link from our most recent email, or subscribe again at https://ourworldindata.org/subscribe.",
        }),
        404
    )
}

function errorResponse(): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Something went wrong",
            message:
                "We couldn't process your confirmation. Please try again later.",
        }),
        500
    )
}
