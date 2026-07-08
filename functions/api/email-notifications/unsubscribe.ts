import * as Sentry from "@sentry/cloudflare"
import { Env } from "../../_common/env.js"
import {
    makeHtmlResponse,
    renderMessagePage,
    unsubscribeUserByToken,
} from "../../_common/emailNotifications.js"

/**
 * Unsubscribe link target from the notification email footers. Unsubscribes
 * the user and shows a human-readable page.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const token = new URL(request.url).searchParams.get("token")
        if (!token || !env.EMAIL_NOTIFICATIONS_DB) {
            return makeHtmlResponse(
                renderMessagePage({
                    title: "Invalid unsubscribe link",
                    message:
                        "This unsubscribe link is not valid. Please use the link from one of our emails.",
                }),
                400
            )
        }

        const email = await unsubscribeUserByToken(
            env.EMAIL_NOTIFICATIONS_DB,
            token
        )
        if (!email) {
            return makeHtmlResponse(
                renderMessagePage({
                    title: "Invalid unsubscribe link",
                    message:
                        "We couldn't find a subscription for this unsubscribe link.",
                }),
                404
            )
        }

        return makeHtmlResponse(
            renderMessagePage({
                title: "You've been unsubscribed",
                message: `${email} won't receive any more email notifications from us. You can re-subscribe at any time at https://ourworldindata.org/subscribe.`,
            })
        )
    } catch (error) {
        Sentry.captureException(error)
        return makeHtmlResponse(
            renderMessagePage({
                title: "Something went wrong",
                message: "We couldn't unsubscribe you. Please try again later.",
            }),
            500
        )
    }
}
