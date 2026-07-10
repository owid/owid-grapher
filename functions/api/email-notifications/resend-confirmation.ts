import * as Sentry from "@sentry/cloudflare"
import {
    EMAIL_NOTIFICATIONS_CONFIRM_TOKEN_TTL_MS,
    EmailNotificationsPreferencesTypeObject,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    confirmationVariantForStatus,
    createEmailToken,
    escapeHtml,
    makeHtmlResponse,
    renderMessagePage,
    sendConfirmationEmail,
} from "../../_common/emailNotifications.js"

interface ConfirmTokenWithUser {
    user_id: number
    payload: string | null
    consumed_at: string | null
    email: string
    status: string
}

/**
 * Form target of the expired-confirmation page's resend button. Issues a
 * fresh confirm token carrying the same pending preferences and re-sends the
 * confirmation email. Safe to expose for expired tokens: the only thing an
 * expired token can do is cause an email to be sent to its own address.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const db = env.EMAIL_NOTIFICATIONS_DB
        const formData = await request.formData().catch(() => null)
        const token = formData?.get("token")
        if (typeof token !== "string" || !token || !db)
            return invalidLinkResponse()

        const row = await db
            .prepare(
                `SELECT tokens.user_id, tokens.payload, tokens.consumed_at,
                        users.email, users.status
                 FROM tokens
                 JOIN users ON users.id = tokens.user_id
                 WHERE tokens.token = ?1 AND tokens.purpose = 'confirm'`
            )
            .bind(token)
            .first<ConfirmTokenWithUser>()
        if (!row) return invalidLinkResponse()
        if (row.consumed_at) {
            return makeHtmlResponse(
                renderMessagePage({
                    title: "Already confirmed",
                    message:
                        "This confirmation link has already been used, so there's nothing left to do. You can change your preferences at any time at https://ourworldindata.org/subscribe.",
                })
            )
        }

        const { data: preferences } =
            EmailNotificationsPreferencesTypeObject.safeParse(
                JSON.parse(row.payload ?? "null")
            )
        if (!preferences) {
            throw new Error(
                "Confirm token has an invalid preferences payload, can't resend"
            )
        }

        const freshToken = await createEmailToken(
            db,
            row.user_id,
            "confirm",
            EMAIL_NOTIFICATIONS_CONFIRM_TOKEN_TTL_MS,
            JSON.stringify(preferences)
        )
        await sendConfirmationEmail(env, new URL(request.url).origin, {
            to: row.email,
            token: freshToken,
            preferences,
            variant: confirmationVariantForStatus(row.status),
        })

        return makeHtmlResponse(
            renderMessagePage({
                title: "Check your inbox",
                message: `We've sent a new confirmation email to ${escapeHtml(row.email)}. The link in it is valid for 48 hours.`,
            })
        )
    } catch (error) {
        Sentry.captureException(error)
        return makeHtmlResponse(
            renderMessagePage({
                title: "Something went wrong",
                message:
                    "We couldn't resend the confirmation email. Please try again later.",
            }),
            500
        )
    }
}

function invalidLinkResponse(): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Invalid link",
            message:
                "This link is not valid. Please subscribe again at https://ourworldindata.org/subscribe.",
        }),
        404
    )
}
