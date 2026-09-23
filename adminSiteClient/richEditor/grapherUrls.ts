/** slug + query string of a grapher chart URL, or null for anything else */
export function parseGrapherUrl(
    url: string
): { slug: string; queryStr: string } | null {
    try {
        const parsed = new URL(url)
        const match = parsed.pathname.match(/\/grapher\/([^/]+)\/?$/)
        if (!match) return null
        return { slug: decodeURIComponent(match[1]), queryStr: parsed.search }
    } catch {
        return null
    }
}
