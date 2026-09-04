import * as Sentry from "@sentry/cloudflare"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS,
    EMAIL_NOTIFICATIONS_FREQUENCY_LABELS,
    EMAIL_NOTIFICATIONS_FROM_ADDRESS,
    EmailNotificationsPreferences,
} from "@ourworldindata/types"
import { JsonError } from "@ourworldindata/utils"
import * as _ from "lodash-es"
import { Env } from "./env.js"
import { getPostmarkClient } from "./postmarkClient.js"

export function validateEmailNotificationsDatabase(env: Env): void {
    if (!env.EMAIL_NOTIFICATIONS_DB) {
        throw new Error("EMAIL_NOTIFICATIONS_DB is not configured")
    }
}

interface PostmarkEmail {
    to: string
    subject: string
    htmlBody: string
    // Postmark message tag, for filtering in the Postmark dashboard.
    tag?: string
}

function renderPreferencesListHtml(
    preferences: EmailNotificationsPreferences
): string {
    // Topic tags are user-submitted strings, so escape them. An empty list
    // means "all topics".
    const topics =
        preferences.topicTags.length > 0
            ? preferences.topicTags.map(_.escape).join(", ")
            : "All topics"
    const contentTypes = preferences.contentTypes
        .map(
            (contentType) =>
                EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS[contentType]
        )
        .join(", ")
    const frequency =
        EMAIL_NOTIFICATIONS_FREQUENCY_LABELS[
            preferences.frequency
        ].toLowerCase()
    return `<ul>
<li><b>Topics:</b> ${topics}</li>
<li><b>Content types:</b> ${contentTypes}</li>
<li><b>Frequency:</b> at most ${frequency}</li>
</ul>`
}

/**
 * Welcome email sent on every subscribe-form submission: signup is single
 * opt-in, so the subscription is already active when this is sent. For an
 * existing address the preferences shown are the merged result. Carries the
 * permanent per-user token's footer links for updating or unsubscribing from
 * these notifications — for an address submitted by someone else, this email is
 * also what lets the owner notice and undo the change.
 */
export async function sendWelcomeEmail(
    env: Env,
    origin: string,
    props: {
        userId: number
        to: string
        preferences: EmailNotificationsPreferences
        userToken: string
    }
): Promise<void> {
    const updatePreferencesUrl = `${origin}/api/email-notifications/request-link?token=${props.userToken}`
    const unsubscribeUrl = `${origin}/api/email-notifications/unsubscribe?token=${props.userToken}`
    await sendPostmarkEmail(env, {
        to: props.to,
        subject: "You're subscribed to Our World in Data updates",
        tag: "email-notifications-welcome",
        htmlBody: `<p>Thanks for subscribing to email updates from Our World in Data! You're all set — you'll receive an email when we publish new work matching your preferences.</p>
<p>These are your notification preferences:</p>
${renderPreferencesListHtml(props.preferences)}
<p>You can <a href="${updatePreferencesUrl}">update your preferences</a> or <a href="${unsubscribeUrl}">unsubscribe from Follow Topics</a> at any time — these links are also in the footer of every Follow Topics email we send.</p>`,
    })
    console.log(`Welcome email sent userId=${props.userId}`)
}

/**
 * Build the preferences-page URL for a magic-link token and send the
 * magic-link email. The token rides in the URL fragment so it stays out of
 * server logs.
 */
export async function sendMagicLinkEmail(
    env: Env,
    origin: string,
    props: { userId: number; to: string; token: string }
): Promise<void> {
    const magicLinkUrl = `${origin}/preferences#token=${props.token}`
    await sendPostmarkEmail(env, {
        to: props.to,
        subject: "Update your Our World in Data notification preferences",
        tag: "email-notifications-magic-link",
        htmlBody: `<p>Click the link below to view and update your Our World in Data email notification preferences. The link is valid for 30 minutes.</p>
<p><a href="${magicLinkUrl}">Update my preferences</a></p>
<p>If you didn't request this, you can safely ignore this email — nothing will change.</p>`,
    })
    console.log(`Magic-link email sent userId=${props.userId}`)
}

/**
 * Send a transactional email via Postmark. Throws when Postmark is not
 * configured or rejects the send.
 */
export async function sendPostmarkEmail(
    env: Env,
    email: PostmarkEmail
): Promise<void> {
    const client = getPostmarkClient(env)
    await client.sendEmail({
        From: EMAIL_NOTIFICATIONS_FROM_ADDRESS,
        To: email.to,
        Subject: email.subject,
        HtmlBody: email.htmlBody,
        MessageStream: "outbound",
        Tag: email.tag,
    })
}

// --- Magic-link tokens (tokens table) ---

export interface EmailTokenRow {
    id: number
    userId: number
    token: string
    expiresAt: string
}

export type EmailTokenLookup =
    | { state: "valid"; row: EmailTokenRow }
    | { state: "expired"; row: EmailTokenRow }
    | { state: "invalid" }

export async function createEmailToken(
    db: D1Database,
    userId: number,
    ttlMs: number
): Promise<string> {
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + ttlMs).toISOString()
    await db
        .prepare(
            `INSERT INTO tokens (userId, token, expiresAt)
             VALUES (?1, ?2, ?3)`
        )
        .bind(userId, token, expiresAt)
        .run()
    return token
}

export async function lookupEmailToken(
    db: D1Database,
    token: string
): Promise<EmailTokenLookup> {
    const row = await db
        .prepare(
            `SELECT id, userId, token, expiresAt
             FROM tokens WHERE token = ?1`
        )
        .bind(token)
        .first<EmailTokenRow>()
    if (!row) return { state: "invalid" }
    if (row.expiresAt <= new Date().toISOString())
        return { state: "expired", row }
    return { state: "valid", row }
}

// --- Standalone HTML pages ---

function renderPage(props: { title: string; bodyHtml: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${props.title} - Our World in Data</title>
<style>
    body {
        margin: 0;
        background-color: #fbf9f3;
        color: #2d2e2d;
        font-family: Lato, "Helvetica Neue", Helvetica, Arial, sans-serif;
    }
    main {
        max-width: 480px;
        margin: 15vh auto 0;
        padding: 0 24px;
        text-align: center;
    }
    h1 {
        font-family: "Playfair Display", Georgia, serif;
        color: #002147;
    }
    a {
        color: #1d3d63;
    }
    button {
        background-color: #1d3d63;
        color: #fff;
        border: none;
        padding: 12px 24px;
        font-size: 16px;
        font-family: inherit;
        cursor: pointer;
    }
</style>
</head>
<body>
<main>
<h1>${props.title}</h1>
${props.bodyHtml}
</main>
</body>
</html>
`
}

/**
 * Minimal standalone HTML page for unsubscribe/request-link responses. These
 * endpoints are opened by clicking links in emails, so they need to render a
 * human-readable page rather than JSON.
 */
export function renderMessagePage(props: {
    title: string
    message: string
}): string {
    return renderPage({
        title: props.title,
        bodyHtml: `<p>${props.message}</p>
<p><a href="https://ourworldindata.org">Go to Our World in Data</a></p>`,
    })
}

/**
 * Like renderMessagePage, but with a single action button that POSTs a token.
 * State changes must never happen on GET (mail security scanners prefetch
 * links in emails), so link targets render one of these pages and the button
 * performs the action.
 */
export function renderActionPage(props: {
    title: string
    message: string
    button: { label: string; action: string; token: string }
}): string {
    const { button } = props
    return renderPage({
        title: props.title,
        bodyHtml: `<p>${props.message}</p>
<form method="post" action="${_.escape(button.action)}">
<input type="hidden" name="token" value="${_.escape(button.token)}" />
<button type="submit">${_.escape(button.label)}</button>
</form>`,
    })
}

export function makeHtmlResponse(html: string, status = 200): Response {
    return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status,
    })
}

/**
 * What every email-notifications endpoint answers with when something fails
 * unexpectedly. The detail goes to Sentry: errors raised by D1, Mailchimp and
 * Postmark quote query fragments, internal identifiers and account state.
 */
export const GENERIC_ERROR_MESSAGE =
    "Something went wrong. Please try again later."

/**
 * Expected client-caused failures (validation, rate limiting) carry messages
 * we authored ourselves, so they are safe to show the user — and reporting
 * them to Sentry would let any abuse burst flood it with events.
 */
function isExpectedClientError(error: unknown): error is JsonError {
    return error instanceof JsonError && error.status < 500
}

// --- Shared endpoint plumbing ---

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // Content-Type must be explicitly allowed for requests to be sent with a
    // Content-Type of "application/json", because "application/json" is not a
    // CORS-safelisted value for it.
    // - https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header
    "Access-Control-Allow-Headers": "Content-Type",
}

const JSON_HEADERS = {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
}

/** Preflight handler; every JSON endpoint exports it as `onRequestOptions`. */
export const handleOptionsRequest: PagesFunction = async () => {
    return new Response(null, { headers: CORS_HEADERS, status: 200 })
}

export function makeJsonResponse(body: object, status: number): Response {
    return new Response(JSON.stringify(body), {
        headers: JSON_HEADERS,
        status,
    })
}

/** Catch-block handler for JSON endpoints: report to Sentry, answer generically. */
export function handleJsonError(error: unknown): Response {
    if (isExpectedClientError(error)) {
        return makeJsonResponse({ error: error.message }, error.status)
    }
    Sentry.captureException(error)
    return makeJsonResponse(
        { error: GENERIC_ERROR_MESSAGE },
        error instanceof JsonError ? error.status : 500
    )
}

/**
 * Unsubscribe the user identified by the given token. Returns the user's
 * email, or null if no user matches the token.
 */
export async function unsubscribeUserByToken(
    db: D1Database,
    token: string
): Promise<string | null> {
    const user = await db
        .prepare(
            `UPDATE users
             SET emailNotificationsStatus = 'unsubscribed',
                 updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE token = ?1
             RETURNING email`
        )
        .bind(token)
        .first<{ email: string }>()
    return user?.email ?? null
}
