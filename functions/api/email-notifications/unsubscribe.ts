import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import {
    escapeHtml,
    makeHtmlResponse,
    renderActionPage,
    renderMessagePage,
    unsubscribeUserByToken,
} from "../../_common/emailNotifications.js"

const UNSUBSCRIBE_PATH = "/api/email-notifications/unsubscribe"

/**
 * Unsubscribe link target from the notification email footers. Renders a
 * confirm page whose button POSTs back here — unsubscribing must not happen
 * on GET, because mail security scanners prefetch links in emails and would
 * silently unsubscribe real users.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const db = env.EMAIL_NOTIFICATIONS_DB
        const token = new URL(request.url).searchParams.get("token")
        if (!token || !db) return invalidLinkResponse()

        const user = await db
            .prepare(`SELECT email, status FROM users WHERE token = ?1`)
            .bind(token)
            .first<{ email: string; status: string }>()
        if (!user) return invalidLinkResponse()
        if (user.status === "unsubscribed") {
            return alreadyUnsubscribedResponse(user.email)
        }

        return makeHtmlResponse(
            renderActionPage({
                title: "Unsubscribe from Our World in Data updates",
                message: `Click below to stop receiving email notifications at ${escapeHtml(user.email)}.`,
                button: {
                    label: "Unsubscribe",
                    action: UNSUBSCRIBE_PATH,
                    token,
                },
            })
        )
    } catch (error) {
        Sentry.captureException(error)
        return errorResponse()
    }
}

/**
 * Performs the unsubscribe. Form target of the confirm page's button, and
 * also the target of the List-Unsubscribe-Post header (one-click
 * unsubscribe): email clients POST directly to the unsubscribe URL — token in
 * the query string, no page shown — so the token is accepted from either the
 * form body or the query string.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const db = env.EMAIL_NOTIFICATIONS_DB
        const formData = await request.formData().catch(() => null)
        const formToken = formData?.get("token")
        const token =
            (typeof formToken === "string" && formToken) ||
            new URL(request.url).searchParams.get("token")
        if (!token || !db) return invalidLinkResponse()

        const email = await unsubscribeUserByToken(db, token)
        if (!email) return invalidLinkResponse()

        return makeHtmlResponse(
            renderMessagePage({
                title: "You've been unsubscribed",
                message: `${escapeHtml(email)} won't receive any more email notifications from us. You can re-subscribe at any time at https://ourworldindata.org/subscribe.`,
            })
        )
    } catch (error) {
        Sentry.captureException(error)
        return errorResponse()
    }
}

function alreadyUnsubscribedResponse(email: string): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Already unsubscribed",
            message: `${escapeHtml(email)} is not receiving email notifications from us. You can re-subscribe at any time at https://ourworldindata.org/subscribe.`,
        })
    )
}

function invalidLinkResponse(): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Invalid unsubscribe link",
            message:
                "This unsubscribe link is not valid. Please use the link from one of our emails.",
        }),
        404
    )
}

function errorResponse(): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Something went wrong",
            message: "We couldn't unsubscribe you. Please try again later.",
        }),
        500
    )
}
