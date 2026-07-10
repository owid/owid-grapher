import * as Sentry from "@sentry/cloudflare"
import { EmailNotificationsBriefStatusResponse } from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import { lookupEmailToken } from "../../_common/emailNotifications.js"
import { getOwidBriefStatus } from "../../_common/mailchimp.js"

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
 * Whether the magic-link token's user is subscribed to the OWID Brief in
 * Mailchimp. Powers the fail-soft Brief toggle on the preferences page: any
 * non-200 response (invalid/expired token, Mailchimp unavailable) makes the
 * page hide the toggle — D1 preferences are never hostage to Mailchimp
 * availability.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const db = env.EMAIL_NOTIFICATIONS_DB
        const token = new URL(request.url).searchParams.get("token")
        if (!token || !db) return jsonResponse({ error: "invalid" }, 404)

        const lookup = await lookupEmailToken(db, token, "magic-link")
        if (lookup.state !== "valid") {
            return jsonResponse(
                { error: lookup.state },
                lookup.state === "expired" ? 410 : 404
            )
        }

        const user = await db
            .prepare(`SELECT email FROM users WHERE id = ?1`)
            .bind(lookup.row.user_id)
            .first<{ email: string }>()
        if (!user) return jsonResponse({ error: "invalid" }, 404)

        const subscribedToOwidBrief = await getOwidBriefStatus(env, user.email)
        if (subscribedToOwidBrief === null) {
            return jsonResponse({ error: "unavailable" }, 503)
        }
        return jsonResponse({ subscribedToOwidBrief }, 200)
    } catch (error) {
        Sentry.captureException(error)
        return jsonResponse({ error: "unavailable" }, 503)
    }
}

function jsonResponse(
    response: EmailNotificationsBriefStatusResponse,
    status: number
): Response {
    return new Response(JSON.stringify(response), {
        headers: JSON_HEADERS,
        status,
    })
}
