import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPE_LABELS,
    EMAIL_NOTIFICATIONS_FREQUENCY_LABELS,
    EMAIL_NOTIFICATIONS_FROM_ADDRESS,
    EmailNotificationsPreferences,
} from "@ourworldindata/types"
import { Env } from "./env.js"

interface PostmarkEmail {
    to: string
    subject: string
    htmlBody: string
    // Postmark message tag, for filtering in the Postmark dashboard.
    tag?: string
}

export function escapeHtml(text: string): string {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function renderPreferencesListHtml(
    preferences: EmailNotificationsPreferences
): string {
    // Topic tags are user-submitted strings, so escape them.
    const topics =
        preferences.topicTags.length > 0
            ? preferences.topicTags.map(escapeHtml).join(", ")
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
 * permanent per-user token's footer links (update preferences / unsubscribe)
 * — for an address submitted by someone else, this email is also what lets
 * the owner notice and undo the change.
 */
export async function sendWelcomeEmail(
    env: Env,
    origin: string,
    props: {
        to: string
        preferences: EmailNotificationsPreferences
        userToken: string
    }
): Promise<void> {
    const updatePreferencesUrl = `${origin}/api/email-notifications/request-link?token=${props.userToken}`
    const unsubscribeUrl = `${origin}/api/email-notifications/unsubscribe?token=${props.userToken}`
    console.log(`Welcome email for ${props.to}`)
    await sendPostmarkEmail(env, {
        to: props.to,
        subject: "You're subscribed to Our World in Data updates",
        tag: "email-notifications-welcome",
        htmlBody: `<p>Thanks for subscribing to email updates from Our World in Data! You're all set — you'll receive an email when we publish new work matching your preferences.</p>
<p>These are your notification preferences:</p>
${renderPreferencesListHtml(props.preferences)}
<p>You can <a href="${updatePreferencesUrl}">update your preferences</a> or <a href="${unsubscribeUrl}">unsubscribe</a> at any time — these links are also in the footer of every email we send.</p>`,
    })
}

/**
 * Build the preferences-page URL for a magic-link token, log it (so the flow
 * can be tested locally without Postmark credentials) and send the magic-link
 * email. The token rides in the URL fragment so it stays out of server logs.
 */
export async function sendMagicLinkEmail(
    env: Env,
    origin: string,
    props: { to: string; token: string }
): Promise<void> {
    const magicLinkUrl = `${origin}/subscribe/preferences#token=${props.token}`
    console.log(`Magic-link email for ${props.to}, URL: ${magicLinkUrl}`)
    await sendPostmarkEmail(env, {
        to: props.to,
        subject: "Update your Our World in Data notification preferences",
        tag: "email-notifications-magic-link",
        htmlBody: `<p>Click the link below to view and update your Our World in Data email notification preferences. The link is valid for 30 minutes.</p>
<p><a href="${magicLinkUrl}">Update my preferences</a></p>
<p>If you didn't request this, you can safely ignore this email — nothing will change.</p>`,
    })
}

/**
 * Send a transactional email via Postmark. Skipped (with a console warning)
 * when POSTMARK_SERVER_TOKEN is not set, so the rest of the flow can be
 * tested locally without Postmark credentials.
 */
export async function sendPostmarkEmail(
    env: Env,
    email: PostmarkEmail
): Promise<void> {
    if (!env.POSTMARK_SERVER_TOKEN) {
        console.warn(
            `POSTMARK_SERVER_TOKEN is not set, skipping email "${email.subject}" to ${email.to}`
        )
        return
    }

    const apiBaseUrl =
        env.POSTMARK_API_BASE_URL || "https://api.postmarkapp.com"
    const response = await fetch(`${apiBaseUrl}/email`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN,
        },
        body: JSON.stringify({
            From: EMAIL_NOTIFICATIONS_FROM_ADDRESS,
            To: email.to,
            Subject: email.subject,
            HtmlBody: email.htmlBody,
            MessageStream: "outbound",
            Tag: email.tag,
        }),
    })
    if (!response.ok) {
        const data = await response.text()
        throw new Error(
            `Failed to send email via Postmark (${response.status}): ${data}`
        )
    }
}

// --- Magic-link tokens (tokens table) ---

export interface EmailTokenRow {
    id: number
    user_id: number
    token: string
    expires_at: string
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
            `INSERT INTO tokens (user_id, token, expires_at)
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
            `SELECT id, user_id, token, expires_at
             FROM tokens WHERE token = ?1`
        )
        .bind(token)
        .first<EmailTokenRow>()
    if (!row) return { state: "invalid" }
    if (row.expires_at <= new Date().toISOString())
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
<form method="post" action="${escapeHtml(button.action)}">
<input type="hidden" name="token" value="${escapeHtml(button.token)}" />
<button type="submit">${escapeHtml(button.label)}</button>
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
             SET status = 'unsubscribed',
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE token = ?1
             RETURNING email`
        )
        .bind(token)
        .first<{ email: string }>()
    return user?.email ?? null
}
