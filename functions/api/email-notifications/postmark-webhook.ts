import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import { validateEmailNotificationsDatabase } from "../../_common/emailNotifications.js"
import {
    PostmarkWebhookEvent,
    applyPostmarkWebhookEvent,
    checkPostmarkWebhookAuthorization,
} from "../../_common/postmarkWebhook.js"

/**
 * Target of Postmark's delivery and subscription-change webhooks.
 * Postmark retries on any non-200 response, so the handler only acknowledges
 * an event after its D1 processing succeeds.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    validateEmailNotificationsDatabase(env)
    validatePostmarkWebhookConfiguration(env)

    if (
        !checkPostmarkWebhookAuthorization(
            request.headers.get("Authorization"),
            env.POSTMARK_WEBHOOK_SECRET
        )
    ) {
        return new Response(null, { status: 403 })
    }

    let event: PostmarkWebhookEvent
    try {
        event = await request.json<PostmarkWebhookEvent>()
    } catch (error) {
        reportWebhookError("Failed to parse Postmark webhook payload", error)
        return new Response(null, { status: 500 })
    }

    try {
        await applyPostmarkWebhookEvent(env.EMAIL_NOTIFICATIONS_DB, event)
        return new Response(null, { status: 200 })
    } catch (error) {
        reportWebhookError("Failed to process Postmark webhook", error)
        return new Response(null, { status: 500 })
    }
}

function reportWebhookError(message: string, error: unknown): void {
    console.error(message, error)
    Sentry.captureException(error)
}

function validatePostmarkWebhookConfiguration(env: Env): void {
    if (!env.POSTMARK_WEBHOOK_SECRET) {
        throw new Error("POSTMARK_WEBHOOK_SECRET is not configured")
    }
}
