import * as Sentry from "@sentry/cloudflare"
import * as z from "zod/mini"
import { Env } from "../../_common/env.js"
import {
    PostmarkSubscriptionChangeEventTypeObject,
    applySubscriptionChange,
    checkPostmarkWebhookAuthorization,
} from "../../_common/postmarkWebhook.js"

/**
 * Target of Postmark's subscription-change webhook, which must be registered
 * (Postmark UI or Webhooks API) on both of our message streams — "outbound"
 * (welcome/magic-link emails) and "broadcast" (notification digests) — with
 * basic-auth credentials in the webhook URL whose password is
 * POSTMARK_WEBHOOK_SECRET. It mirrors Postmark's suppression state (hard
 * bounces, spam complaints, manual suppressions, reactivations) into the
 * users table, so the send job can skip undeliverable addresses and the
 * suppression record survives independently of Postmark.
 *
 * Response codes matter to Postmark's retry logic (only 3 attempts over ~21
 * minutes for this webhook type): 403 stops retries (bad credentials), any
 * other non-2xx is retried. Payloads that will never parse are acknowledged
 * with 200 and reported to Sentry — retrying them is pointless.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const db = env.EMAIL_NOTIFICATIONS_DB
        const secret = env.POSTMARK_WEBHOOK_SECRET
        if (!db || !secret) {
            console.warn(
                "EMAIL_NOTIFICATIONS_DB or POSTMARK_WEBHOOK_SECRET is not configured, rejecting Postmark webhook"
            )
            return new Response(null, { status: 503 })
        }

        if (
            !checkPostmarkWebhookAuthorization(
                request.headers.get("Authorization"),
                secret
            )
        ) {
            return new Response(null, { status: 403 })
        }

        let rawPayload: unknown
        try {
            rawPayload = await request.json()
        } catch {
            Sentry.captureMessage("Malformed Postmark webhook payload")
            return okResponse()
        }

        const { data: event, error } =
            PostmarkSubscriptionChangeEventTypeObject.safeParse(rawPayload)
        if (!event) {
            // Also hit when another webhook type (Bounce, Delivery, ...) is
            // misconfigured to point here — the Sentry event is the signal.
            Sentry.captureMessage(
                `Unexpected Postmark webhook payload: ${z.prettifyError(error)}`
            )
            return okResponse()
        }

        await applySubscriptionChange(db, event)
        return okResponse()
    } catch (error) {
        Sentry.captureException(error)
        // Non-2xx and non-403, so Postmark retries: the error may be
        // transient (e.g. a D1 hiccup).
        return new Response(null, { status: 500 })
    }
}

function okResponse(): Response {
    return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
    })
}
