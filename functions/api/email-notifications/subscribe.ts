import * as Sentry from "@sentry/cloudflare"
import * as z from "zod/mini"
import {
    EmailNotificationsPreferences,
    EmailNotificationsSubscribeRequestTypeObject,
    EmailNotificationsSubscribeResponse,
    JsonError,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    makeWelcomeEmail,
    sendPostmarkEmail,
} from "../../_common/emailNotifications.js"

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
            const { user, isNewUser } = await upsertNotificationPreferences(
                env.EMAIL_NOTIFICATIONS_DB,
                email,
                data.notifications
            )
            // Single opt-in: users are subscribed immediately. First-time
            // users get a one-time welcome email; existing users just get
            // their preferences updated.
            if (isNewUser) {
                await sendWelcomeEmail(
                    env,
                    new URL(request.url).origin,
                    email,
                    user.token,
                    data.notifications
                )
            }
        }

        if (data.subscribeToOwidBrief) {
            await subscribeToOwidBriefNewsletter(env, email)
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

async function upsertNotificationPreferences(
    db: D1Database,
    email: string,
    preferences: EmailNotificationsPreferences
): Promise<{ user: EmailNotificationsUser; isNewUser: boolean }> {
    let isNewUser = false
    let user = await db
        .prepare(`SELECT id, token FROM users WHERE email = ?1`)
        .bind(email)
        .first<EmailNotificationsUser>()
    if (user) {
        // Re-subscribing reactivates an unsubscribed user.
        await db
            .prepare(
                `UPDATE users
                 SET status = 'subscribed',
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1`
            )
            .bind(user.id)
            .run()
    } else {
        isNewUser = true
        user = await db
            .prepare(
                `INSERT INTO users (email, token)
                 VALUES (?1, ?2)
                 RETURNING id, token`
            )
            .bind(email, crypto.randomUUID())
            .first<EmailNotificationsUser>()
    }
    if (!user) {
        throw new JsonError("Failed to store subscription", 500)
    }
    await db
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
            JSON.stringify(preferences.topicTags),
            JSON.stringify(preferences.contentTypes),
            preferences.frequency
        )
        .run()
    return { user, isNewUser }
}

async function sendWelcomeEmail(
    env: Env,
    origin: string,
    email: string,
    token: string,
    preferences: EmailNotificationsPreferences
): Promise<void> {
    const unsubscribeUrl = `${origin}/api/email-notifications/unsubscribe?token=${token}`
    // Log the unsubscribe URL so the flow can be tested locally without
    // Postmark credentials.
    console.log(
        `Welcome email for ${email}, unsubscribe URL: ${unsubscribeUrl}`
    )
    await sendPostmarkEmail(
        env,
        makeWelcomeEmail({ to: email, preferences, unsubscribeUrl })
    )
}

// The OWID Brief newsletter stays in Mailchimp, so subscribing to it means
// upserting the Mailchimp list member with the OWID Brief interest (group)
// checked.
async function subscribeToOwidBriefNewsletter(
    env: Env,
    email: string
): Promise<void> {
    if (
        !env.MAILCHIMP_API_KEY ||
        !env.MAILCHIMP_API_SERVER ||
        !env.MAILCHIMP_NEWSLETTER_LIST_ID
    ) {
        // Allows testing the rest of the flow locally without Mailchimp
        // credentials.
        console.warn(
            "Mailchimp environment variables are not set, skipping OWID Brief subscription"
        )
        return
    }

    const subscriberDigest = await crypto.subtle.digest(
        // MD5 is not part of the WebCrypto standard but is supported in
        // Cloudflare Workers for interacting with legacy systems that require
        // MD5.
        // https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
        { name: "MD5" },
        new TextEncoder().encode(email)
    )
    const subscriberHash = [...new Uint8Array(subscriberDigest)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")

    const member: Record<string, unknown> = {
        email_address: email,
        // New list members go through Mailchimp's double opt-in confirmation.
        // Existing members keep their current status.
        status_if_new: "pending",
    }
    if (env.MAILCHIMP_OWID_BRIEF_INTEREST_ID) {
        member.interests = { [env.MAILCHIMP_OWID_BRIEF_INTEREST_ID]: true }
    }

    const response = await fetch(
        `https://${env.MAILCHIMP_API_SERVER}.api.mailchimp.com/3.0/lists/${env.MAILCHIMP_NEWSLETTER_LIST_ID}/members/${subscriberHash}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Basic ${btoa(`anystring:${env.MAILCHIMP_API_KEY}`)}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(member),
        }
    )
    if (!response.ok) {
        const data = await response.json()
        console.error("Failed to subscribe user to the OWID Brief", data)
        Sentry.captureMessage("Failed to subscribe user to the OWID Brief", {
            level: "error",
            extra: { response: data },
        })
        throw new JsonError(
            "Failed to subscribe to the OWID Brief newsletter. Please try again later.",
            500
        )
    }
}
