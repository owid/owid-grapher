import * as Sentry from "@sentry/cloudflare"
import * as z from "zod/mini"
import {
    EMAIL_NOTIFICATIONS_CONFIRM_TOKEN_TTL_MS,
    EmailNotificationsSubscribeRequestTypeObject,
    EmailNotificationsSubscribeResponse,
    JsonError,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    confirmationVariantForStatus,
    createEmailToken,
    sendConfirmationEmail,
} from "../../_common/emailNotifications.js"
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
            // Every submission takes the same pending-confirmation path,
            // regardless of the email's current state: the chosen preferences
            // are held on a confirm token and nothing changes until the
            // confirmation email is acted on. This means no preference change
            // or (re)subscription ever happens without proof of inbox
            // control, and the response is identical whether the email was
            // already known or not.
            const db = env.EMAIL_NOTIFICATIONS_DB
            const user = await upsertPendingUser(db, email)
            const confirmToken = await createEmailToken(
                db,
                user.id,
                "confirm",
                EMAIL_NOTIFICATIONS_CONFIRM_TOKEN_TTL_MS,
                JSON.stringify(data.notifications)
            )
            await sendConfirmationEmail(env, new URL(request.url).origin, {
                to: email,
                token: confirmToken,
                preferences: data.notifications,
                variant: confirmationVariantForStatus(user.status),
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
    status: string
}

/**
 * Find the user for this email, or create one in the 'pending' state. Never
 * touches an existing user's status or preferences — those only change when a
 * confirm token is consumed.
 */
async function upsertPendingUser(
    db: D1Database,
    email: string
): Promise<EmailNotificationsUser> {
    const existing = await db
        .prepare(`SELECT id, status FROM users WHERE email = ?1`)
        .bind(email)
        .first<EmailNotificationsUser>()
    if (existing) return existing
    const created = await db
        .prepare(
            `INSERT INTO users (email, token, status)
             VALUES (?1, ?2, 'pending')
             RETURNING id, status`
        )
        .bind(email, crypto.randomUUID())
        .first<EmailNotificationsUser>()
    if (!created) {
        throw new JsonError("Failed to store subscription", 500)
    }
    return created
}
