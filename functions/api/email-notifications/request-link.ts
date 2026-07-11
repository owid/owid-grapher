import * as Sentry from "@sentry/cloudflare"
import * as z from "zod/mini"
import {
    EMAIL_NOTIFICATIONS_MAGIC_LINK_TTL_MS,
    EmailNotificationsRequestLinkRequestTypeObject,
    EmailNotificationsSubscribeResponse,
    JsonError,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import { Env } from "../../_common/env.js"
import {
    createEmailToken,
    escapeHtml,
    makeHtmlResponse,
    renderActionPage,
    renderMessagePage,
    sendMagicLinkEmail,
} from "../../_common/emailNotifications.js"

const REQUEST_LINK_PATH = "/api/email-notifications/request-link"

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
 * "Email me a link" page target from the notification email footers, with a
 * `token` query parameter (the permanent per-user token). Renders a page
 * whose button POSTs back here — following Mailchimp's pattern, the in-email
 * token can only *request* a magic link; viewing and editing preferences
 * requires proving control of the inbox right now via the short-lived link.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
    try {
        const db = env.EMAIL_NOTIFICATIONS_DB
        const token = new URL(request.url).searchParams.get("token")
        if (!token || !db) return invalidLinkResponse()

        const user = await db
            .prepare(`SELECT email FROM users WHERE token = ?1`)
            .bind(token)
            .first<{ email: string }>()
        if (!user) return invalidLinkResponse()

        return makeHtmlResponse(
            renderActionPage({
                title: "Update your preferences",
                message: `To keep your subscription secure, we'll email a sign-in link to ${escapeHtml(user.email)}. The link is valid for 30 minutes.`,
                button: {
                    label: "Email me a link",
                    action: REQUEST_LINK_PATH,
                    token,
                },
            })
        )
    } catch (error) {
        Sentry.captureException(error)
        return makeHtmlResponse(
            renderMessagePage({
                title: "Something went wrong",
                message:
                    "We couldn't process your request. Please try again later.",
            }),
            500
        )
    }
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
        const db = env.EMAIL_NOTIFICATIONS_DB
        if (!db) throw new JsonError("Database is not configured", 500)

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
                throw new JsonError("Missing token", 400)
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
                "magic-link",
                EMAIL_NOTIFICATIONS_MAGIC_LINK_TTL_MS
            )
            await sendMagicLinkEmail(env, new URL(request.url).origin, {
                to: user.email,
                token: magicToken,
            })
        }

        if (isJson) {
            const response: EmailNotificationsSubscribeResponse = { ok: true }
            return new Response(JSON.stringify(response), {
                headers: JSON_HEADERS,
                status: 200,
            })
        }
        return makeHtmlResponse(
            renderMessagePage({
                title: "Check your inbox",
                message:
                    "If that address is subscribed to email notifications, a link to update its preferences is on its way. The link is valid for 30 minutes.",
            })
        )
    } catch (error) {
        if (!(error instanceof JsonError) || error.status >= 500) {
            Sentry.captureException(error)
        }
        if (isJson) {
            const response: EmailNotificationsSubscribeResponse = {
                error: stringifyUnknownError(error) ?? "Unknown error",
            }
            return new Response(JSON.stringify(response), {
                headers: JSON_HEADERS,
                status: error instanceof JsonError ? error.status : 500,
            })
        }
        return makeHtmlResponse(
            renderMessagePage({
                title: "Something went wrong",
                message: "We couldn't send the link. Please try again later.",
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
             JOIN users ON users.id = tokens.user_id
             WHERE tokens.token = ?1 AND tokens.purpose = 'magic-link'`
        )
        .bind(token)
        .first<UserIdEmail>()
}
