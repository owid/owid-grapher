import { parseCookie } from "cookie"

// Extracts the client ID from a Google Analytics cookie value.
// e.g. GA1.1.156980023.1749503476 -> 156980023.1749503476
export function extractClientIdFromGACookie(
    cookieValue?: string
): string | null {
    if (!cookieValue) return null
    const parts = cookieValue.split(".")
    if (parts.length >= 4) {
        return `${parts[2]}.${parts[3]}`
    }
    return cookieValue // fallback to using the whole value
}

export function getAnalyticsConsentValue(request: Request) {
    const parsedCookies = parseCookie(request.headers.get("Cookie") || "")
    const preferencesRaw = parsedCookies["cookie_preferences"]
    let value = false
    if (preferencesRaw) {
        preferencesRaw.split("|").map((p) => {
            const [pRaw] = p.split("-")
            const [type, valueRaw] = pRaw.split(":")
            if (type === "a") {
                value = valueRaw === "1"
            }
        })
    }
    return value
}
