export function parseCookies(request: Request): Record<string, string> {
    const cookieHeader = request.headers.get("Cookie")
    if (!cookieHeader) return {}

    const parsedCookies: Record<string, string> = {}

    cookieHeader.split(";").forEach((cookie) => {
        const trimmedCookie = cookie.trim()
        const equalIndex = trimmedCookie.indexOf("=")

        // Handle cookies without values (like secure flags) or malformed cookies
        if (equalIndex === -1) return

        const key = trimmedCookie.slice(0, equalIndex).trim()
        const value = trimmedCookie.slice(equalIndex + 1)

        // Skip empty keys
        if (!key) return

        // URL decode the value (cookies can be URL encoded)
        try {
            parsedCookies[key] = decodeURIComponent(value)
        } catch {
            // If decoding fails, use the raw value
            parsedCookies[key] = value
        }
    })

    return parsedCookies
}

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

export function getAnalyticsConsentValue(request) {
    const parsedCookies = parseCookies(request)
    const preferencesRaw = parsedCookies["cookie_preferences"]
    let value = false
    if (preferencesRaw) {
        preferencesRaw.split("|").map((p) => {
            const [pRaw /* dateRaw */] = p.split("-")
            const [type, valueRaw] = pRaw.split(":")
            if (type === "a") {
                value = valueRaw === "1"
            }
        })
    }
    return value
}
