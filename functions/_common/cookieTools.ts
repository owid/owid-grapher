export function parseCookies(request: Request): Record<string, string> {
    const cookieHeader = request.headers.get("Cookie")
    if (!cookieHeader) return {}

    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim())
    const parsedCookies: Record<string, string> = {}

    for (const cookie of cookies) {
        const [key, value] = cookie.split("=")
        parsedCookies[key] = value
    }

    return parsedCookies
}
