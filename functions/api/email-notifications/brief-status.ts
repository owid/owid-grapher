import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import {
    handleOptionsRequest,
    lookupEmailToken,
    makeJsonResponse,
} from "../../_common/emailNotifications.js"
import { getOwidBriefStatus } from "../../_common/mailchimp.js"

export const onRequestOptions = handleOptionsRequest

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
        if (!token || !db) return makeJsonResponse({ error: "invalid" }, 404)

        const lookup = await lookupEmailToken(db, token)
        if (lookup.state !== "valid") {
            return makeJsonResponse(
                { error: lookup.state },
                lookup.state === "expired" ? 410 : 404
            )
        }

        const user = await db
            .prepare(`SELECT email FROM users WHERE id = ?1`)
            .bind(lookup.row.user_id)
            .first<{ email: string }>()
        if (!user) return makeJsonResponse({ error: "invalid" }, 404)

        const subscribedToOwidBrief = await getOwidBriefStatus(env, user.email)
        if (subscribedToOwidBrief === null) {
            return makeJsonResponse({ error: "unavailable" }, 503)
        }
        return makeJsonResponse({ subscribedToOwidBrief }, 200)
    } catch (error) {
        Sentry.captureException(error)
        return makeJsonResponse({ error: "unavailable" }, 503)
    }
}
