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

function escapeHtml(text: string): string {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

/**
 * One-time welcome email for first-time subscribers, spelling out the
 * preferences they signed up with.
 */
export function makeWelcomeEmail(props: {
    to: string
    preferences: EmailNotificationsPreferences
    unsubscribeUrl: string
}): PostmarkEmail {
    const { preferences, unsubscribeUrl } = props
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
    return {
        to: props.to,
        subject: "You're subscribed to Our World in Data updates",
        tag: "email-notifications-welcome",
        htmlBody: `<p>Thanks for subscribing to email updates from Our World in Data!</p>
<p>You signed up for:</p>
<ul>
<li><b>Topics:</b> ${topics}</li>
<li><b>Content types:</b> ${contentTypes}</li>
<li><b>Frequency:</b> at most ${frequency}</li>
</ul>
<p>You'll only hear from us when we publish new work matching these preferences.</p>
<p>You can change what you receive by <a href="https://ourworldindata.org/subscribe">subscribing again</a> with the same email address and different preferences, or <a href="${unsubscribeUrl}">unsubscribe</a> at any time.</p>`,
    }
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

/**
 * Minimal standalone HTML page for confirm/unsubscribe responses. These
 * endpoints are opened by clicking links in emails, so they need to render a
 * human-readable page rather than JSON.
 */
export function renderMessagePage(props: {
    title: string
    message: string
}): string {
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
</style>
</head>
<body>
<main>
<h1>${props.title}</h1>
<p>${props.message}</p>
<p><a href="https://ourworldindata.org">Go to Our World in Data</a></p>
</main>
</body>
</html>
`
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
