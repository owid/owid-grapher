// URL fetch proxy for the rich editor's AI assistant. A regular admin page
// cannot fetch arbitrary cross-origin URLs (unlike the MV3 extension the
// assistant is ported from), so read_url / code_fetch_file route through
// here. Same-origin admin auth applies (this sits behind the normal
// authenticated /admin/api middleware); the SSRF guard is shared with the
// client via adminShared.

import { Request } from "express"
import { blockedFetchReason } from "../../adminShared/urlFetchGuard.js"

const FETCH_TIMEOUT_MS = 15_000
const MAX_BODY_BYTES = 5_000_000

export interface AssistantFetchResponse {
    status: number
    finalUrl: string
    contentType: string
    body: string
}

export async function assistantFetchUrl(
    req: Request
): Promise<AssistantFetchResponse> {
    const url = String(req.query.url ?? "")
    const reason = blockedFetchReason(url)
    if (reason) throw new Error(reason)

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    try {
        const response = await fetch(url, {
            redirect: "follow",
            signal: ctrl.signal,
            headers: {
                accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
                "user-agent":
                    "OWID-Admin-Assistant/1.0 (+https://ourworldindata.org)",
            },
        })
        // the redirect target must pass the guard too
        const finalReason = blockedFetchReason(response.url || url)
        if (finalReason) throw new Error(finalReason)
        const declaredLength = Number(
            response.headers.get("content-length") ?? "0"
        )
        if (declaredLength > MAX_BODY_BYTES)
            throw new Error(
                `Page is too large to read (${declaredLength} bytes).`
            )
        const body = await response.text()
        if (body.length > MAX_BODY_BYTES)
            throw new Error(`Page is too large to read (${body.length} chars).`)
        return {
            status: response.status,
            finalUrl: response.url || url,
            contentType: (
                response.headers.get("content-type") ?? ""
            ).toLowerCase(),
            body,
        }
    } finally {
        clearTimeout(timer)
    }
}
