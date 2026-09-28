import * as _ from "lodash-es"
import * as z from "zod/mini"
import {
    EMAIL_NOTIFICATIONS_MAGIC_LINK_TTL_MS,
    JsonError,
} from "@ourworldindata/utils"
import { EmailNotificationsRequestLinkRequestTypeObject } from "@ourworldindata/types/email-notifications-schemas"
import { Env } from "../../_common/env.js"
import {
    createEmailToken,
    handleJsonError,
    handleOptionsRequest,
    makeHtmlResponse,
    makeJsonResponse,
    renderActionPage,
    renderMessagePage,
    sendMagicLinkEmail,
    validateEmailNotificationsDatabase,
} from "../../_common/emailNotifications.js"

export const onRequestOptions = handleOptionsRequest

const REQUEST_LINK_PATH = "/api/email-notifications/request-link"

/**
 * "Email me a link" page target from the notification email footers, with a
 * `token` query parameter (the permanent per-user token). Renders a page
 * whose button POSTs back here — following Mailchimp's pattern, the in-email
 * token can only *request* a magic link; viewing and editing preferences
 * requires proving control of the inbox right now via the short-lived link.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    validateEmailNotificationsDatabase(env)
    const db = env.EMAIL_NOTIFICATIONS_DB
    const token = new URL(request.url).searchParams.get("token")
    if (!token) return invalidLinkResponse()

    const user = await db
        .prepare(`SELECT email FROM users WHERE token = ?1`)
        .bind(token)
        .first<{ email: string }>()
    if (!user) return invalidLinkResponse()

    return makeHtmlResponse(
        renderActionPage({
            title: "Update your preferences",
            message: `To keep your subscription secure, we'll email a sign-in link to ${_.escape(user.email)}. The link is valid for 30 minutes.`,
            button: {
                label: "Email me a link",
                action: REQUEST_LINK_PATH,
                token,
            },
        })
    )
}

/**
 * Sends a magic-link email. Accepts either:
 * - a form POST with a `token` field (from the "Email me a link" page or an
 *   expired magic-link's resend) → responds with a "Check your inbox" page;
 * - a JSON POST with `email` or `token` (from the preferences page's
 *   enter-email UI / expired state) → responds with JSON.
 *
 * For unknown emails the response is IDENTICAL and no email is sent: a
 * courtesy "you're not subscribed" email would turn this endpoint into a tool
 * for sending unsolicited mail to arbitrary addresses.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
    const isJson = request.headers
        .get("Content-Type")
        ?.includes("application/json")
    try {
        validateEmailNotificationsDatabase(env)
        const db = env.EMAIL_NOTIFICATIONS_DB

        let email: string | undefined
        let token: string | undefined
        if (isJson) {
            let rawPayload: unknown
            try {
                rawPayload = await request.json()
            } catch {
                throw new JsonError("Malformed JSON payload", 400)
            }
            const { data, error } =
                EmailNotificationsRequestLinkRequestTypeObject.safeParse(
                    rawPayload
                )
            if (!data) {
                throw new JsonError(
                    `Invalid request: ${z.prettifyError(error)}`,
                    400
                )
            }
            email = data.email
            token = data.token
        } else {
            const formData = await request.formData().catch(() => null)
            const formToken = formData?.get("token")
            if (typeof formToken !== "string" || !formToken) {
                return invalidLinkResponse()
            }
            token = formToken
        }

        const user = email
            ? await findUserByEmail(db, email.trim().toLowerCase())
            : await findUserByAnyToken(db, token!)

        // Unknown email: identical response, no email sent (no-enumeration).
        // Unknown token: same — a bogus token proves nothing.
        if (user) {
            const magicToken = await createEmailToken(
                db,
                user.id,
                EMAIL_NOTIFICATIONS_MAGIC_LINK_TTL_MS
            )
            const siteBaseUrl =
                env.EMAIL_NOTIFICATIONS_SITE_BASE_URL ||
                new URL(request.url).origin
            await sendMagicLinkEmail(env, siteBaseUrl, {
                userId: user.id,
                to: user.email,
                token: magicToken,
            })
        }

        if (isJson) return makeJsonResponse({ ok: true }, 200)
        return makeHtmlResponse(
            renderMessagePage({
                title: "Check your inbox",
                message:
                    "If that address is subscribed to email notifications, a link to update its preferences is on its way. The link is valid for 30 minutes.",
            })
        )
    } catch (error) {
        if (isJson) {
            return handleJsonError(
                error,
                "Failed to request an email notification preferences link"
            )
        }
        throw error
    }
}

function invalidLinkResponse(): Response {
    return makeHtmlResponse(
        renderMessagePage({
            title: "Invalid link",
            message:
                "This link is not valid. Please use the link from one of our emails.",
        }),
        404
    )
}

interface UserIdEmail {
    id: number
    email: string
}

async function findUserByEmail(
    db: D1Database,
    email: string
): Promise<UserIdEmail | null> {
    return await db
        .prepare(`SELECT id, email FROM users WHERE email = ?1`)
        .bind(email)
        .first<UserIdEmail>()
}

/**
 * Resolve a token to its user: the permanent per-user token (email footer
 * links), or a magic-link token in any state — an expired magic link's only
 * remaining power is causing an email to be sent to its own address, which is
 * exactly what this endpoint does.
 */
async function findUserByAnyToken(
    db: D1Database,
    token: string
): Promise<UserIdEmail | null> {
    const byPermanentToken = await db
        .prepare(`SELECT id, email FROM users WHERE token = ?1`)
        .bind(token)
        .first<UserIdEmail>()
    if (byPermanentToken) return byPermanentToken
    return await db
        .prepare(
            `SELECT users.id, users.email
             FROM tokens
             JOIN users ON users.id = tokens.userId
             WHERE tokens.token = ?1`
        )
        .bind(token)
        .first<UserIdEmail>()
}
