import * as _ from "lodash-es"
import { Env } from "../../_common/env.js"
import {
    makeHtmlResponse,
    renderActionPage,
    renderMessagePage,
    unsubscribeUserByToken,
    validateEmailNotificationsDatabase,
} from "../../_common/emailNotifications.js"

const UNSUBSCRIBE_PATH = "/api/email-notifications/unsubscribe"

/**
 * Unsubscribe link target from the notification email footers. Renders a
 * confirm page whose button POSTs back here — unsubscribing must not happen
 * on GET, because mail security scanners prefetch links in emails and would
 * silently unsubscribe real users.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    validateEmailNotificationsDatabase(env)
    const db = env.EMAIL_NOTIFICATIONS_DB
    const token = new URL(request.url).searchParams.get("token")
    if (!token) return invalidLinkResponse()

    const user = await db
        .prepare(
            `SELECT email, emailNotificationsStatus
             FROM users WHERE token = ?1`
        )
        .bind(token)
        .first<{ email: string; emailNotificationsStatus: string }>()
    if (!user) return invalidLinkResponse()
    if (user.emailNotificationsStatus === "unsubscribed") {
        return alreadyUnsubscribedResponse(user.email)
    }

    return makeHtmlResponse(
        renderActionPage({
            title: "Unsubscribe from Our World in Data updates",
            message: `Click below to stop receiving Follow Topics notifications at ${_.escape(user.email)}. Your OWID Brief subscription is managed separately by Mailchimp.`,
            button: {
                label: "Unsubscribe",
                action: UNSUBSCRIBE_PATH,
                token,
            },
        })
    )
}

/**
 * Performs the unsubscribe. Form target of the confirm page's button. The
 * token is accepted from either the form body or the query string.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    validateEmailNotificationsDatabase(env)
    const db = env.EMAIL_NOTIFICATIONS_DB
    const formData = await request.formData().catch(() => null)
    const formToken = formData?.get("token")
    const token =
        (typeof formToken === "string" && formToken) ||
        new URL(request.url).searchParams.get("token")
    if (!token) return invalidLinkResponse()

    const email = await unsubscribeUserByToken(db, token)
    if (!email) return invalidLinkResponse()

    return makeHtmlResponse(
        renderMessagePage({
            title: "You've been unsubscribed",
            message: `${_.escape(email)} won't receive any more Follow Topics notifications from us. The OWID Brief is managed separately by Mailchimp. You can re-subscribe at any time at https://ourworldindata.org/subscribe.`,
        })
    )
}

function alreadyUnsubscribedResponse(email: string): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Already unsubscribed",
            message: `${_.escape(email)} is not receiving Follow Topics notifications from us. The OWID Brief is managed separately by Mailchimp. You can re-subscribe at any time at https://ourworldindata.org/subscribe.`,
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
