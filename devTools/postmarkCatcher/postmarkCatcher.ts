/**
 * Local stand-in for the Postmark API, for developing and click-testing email
 * flows without sending real email (Postmark only allows 100 real sends
 * before the account is approved).
 *
 * Usage:
 *   yarn postmarkCatcher
 * then point the senders at it:
 *   POSTMARK_API_BASE_URL=http://localhost:8025 (in .env and .dev.vars)
 *
 * Accepts POST /email (and /email/batch), stores the payloads in memory, and
 * serves an index at http://localhost:8025 with each email's HTML body
 * viewable, so magic links can be clicked.
 */
import http from "node:http"
import crypto from "node:crypto"

const PORT = parseInt(process.env.POSTMARK_CATCHER_PORT || "8025", 10)

interface CaughtEmail {
    receivedAt: Date
    payload: Record<string, unknown>
}

const emails: CaughtEmail[] = []

function escapeHtml(text: string): string {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
}

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let body = ""
        req.on("data", (chunk) => (body += chunk))
        req.on("end", () => resolve(body))
        req.on("error", reject)
    })
}

function sendJson(
    res: http.ServerResponse,
    status: number,
    data: unknown
): void {
    res.writeHead(status, { "Content-Type": "application/json" })
    res.end(JSON.stringify(data))
}

function sendHtml(res: http.ServerResponse, html: string): void {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end(html)
}

/** The success response shape of Postmark's POST /email. */
function makeSendResponse(payload: Record<string, unknown>) {
    return {
        To: payload.To,
        SubmittedAt: new Date().toISOString(),
        MessageID: crypto.randomUUID(),
        ErrorCode: 0,
        Message: "OK",
    }
}

function acceptEmail(payload: Record<string, unknown>) {
    emails.unshift({ receivedAt: new Date(), payload })
    console.log(`Caught email to ${payload.To}: "${payload.Subject}"`)
    return makeSendResponse(payload)
}

function renderIndexPage(): string {
    const rows = emails
        .map((email, index) => {
            const { To, Subject, MessageStream, Tag } = email.payload
            return `<tr>
<td>${email.receivedAt.toLocaleTimeString()}</td>
<td>${escapeHtml(String(To ?? ""))}</td>
<td><a href="/emails/${index}/html">${escapeHtml(String(Subject ?? "(no subject)"))}</a></td>
<td>${escapeHtml(String(MessageStream ?? ""))}</td>
<td>${escapeHtml(String(Tag ?? ""))}</td>
<td><a href="/emails/${index}/json">json</a></td>
</tr>`
        })
        .join("\n")
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="2" />
<title>Postmark catcher</title>
<style>
    body { font-family: system-ui, sans-serif; margin: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 4px 12px 4px 0; border-bottom: 1px solid #ddd; }
</style>
</head>
<body>
<h1>Postmark catcher</h1>
<p>${emails.length} email(s) caught. Newest first; refreshes every 2s.</p>
<table>
<tr><th>Received</th><th>To</th><th>Subject</th><th>Stream</th><th>Tag</th><th></th></tr>
${rows}
</table>
</body>
</html>`
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)

    if (req.method === "POST" && /^\/email(\/batch)?$/.test(url.pathname)) {
        if (!req.headers["x-postmark-server-token"]) {
            // Mimics Postmark, so a missing-token bug shows up locally too.
            return sendJson(res, 401, {
                ErrorCode: 10,
                Message:
                    "No Account or Server API tokens were supplied in the HTTP headers.",
            })
        }
        let parsed: unknown
        try {
            parsed = JSON.parse(await readBody(req))
        } catch {
            return sendJson(res, 422, {
                ErrorCode: 300,
                Message: "Invalid JSON",
            })
        }
        if (url.pathname === "/email/batch") {
            if (!Array.isArray(parsed))
                return sendJson(res, 422, {
                    ErrorCode: 300,
                    Message: "Expected an array of emails",
                })
            return sendJson(
                res,
                200,
                (parsed as Record<string, unknown>[]).map(acceptEmail)
            )
        }
        return sendJson(
            res,
            200,
            acceptEmail(parsed as Record<string, unknown>)
        )
    }

    if (req.method === "GET") {
        if (url.pathname === "/") return sendHtml(res, renderIndexPage())
        const match = url.pathname.match(/^\/emails\/(\d+)\/(html|json)$/)
        if (match) {
            const email = emails[parseInt(match[1], 10)]
            if (!email) return sendJson(res, 404, { Message: "No such email" })
            if (match[2] === "json") return sendJson(res, 200, email.payload)
            return sendHtml(
                res,
                String(email.payload.HtmlBody ?? "(no HtmlBody)")
            )
        }
    }

    sendJson(res, 404, { Message: "Not found" })
})

server.listen(PORT, () => {
    console.log(`Postmark catcher listening on http://localhost:${PORT}`)
    console.log(
        `Point senders at it with POSTMARK_API_BASE_URL=http://localhost:${PORT}`
    )
})
