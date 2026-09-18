export type SqlQueryFn = (
    sql: string,
    parameters?: unknown[]
) => Promise<unknown>

const OWID_HOSTS = new Set(["ourworldindata.org", "www.ourworldindata.org"])

/** Paths that never resolve to a gdoc */
const NON_GDOC_PATH_PREFIXES = ["grapher/", "explorers/", "uploads/", "images/"]

const MAX_REDIRECT_HOPS = 5

/**
 * How URL paths map to posts_gdocs rows — the inverse of
 * getPrefixedGdocPath in @ourworldindata/components. Slug is not unique
 * across types, so lookups must be type-aware.
 */
function pathToGdocLookup(path: string): { slug: string; types: string[] } {
    const prefixed = (
        prefix: string,
        types: string[]
    ): { slug: string; types: string[] } | null =>
        path.startsWith(`${prefix}/`)
            ? { slug: path.slice(prefix.length + 1), types }
            : null
    return (
        prefixed("data-insights", ["data-insight"]) ??
        prefixed("team", ["author"]) ??
        prefixed("profile", ["profile"]) ?? {
            slug: path,
            types: [
                "article",
                "topic-page",
                "linear-topic-page",
                "about-page",
                "announcement",
            ],
        }
    )
}

/**
 * Extracts a clean slug path from an OWID URL, or null when the URL can't
 * cleanly map to a gdoc: non-OWID hosts, the homepage, and URLs carrying a
 * query string or anchor (a docs.google.com URL can't represent those, so
 * rewriting would lose information — the link is left alone instead).
 */
function pathFromOwidUrl(url: URL): string | null {
    if (!OWID_HOSTS.has(url.hostname)) return null
    if (url.search !== "" || url.hash !== "") return null
    const path = decodeURIComponent(url.pathname).replace(/^\/+|\/+$/g, "")
    return path === "" ? null : path
}

/**
 * Creates a resolver from ourworldindata.org URLs to the docs.google.com
 * URLs of the published gdocs behind them, following exact-match redirect
 * chains. Deliberately conservative: anything that doesn't resolve cleanly
 * (grapher/explorer pages, wildcard-only redirects, query strings, anchors,
 * unknown or ambiguous slugs) returns null, and the calling transform should
 * leave the link unchanged.
 *
 * Results are cached per resolver instance — create one per run.
 */
export function createOwidUrlResolver(
    query: SqlQueryFn
): (url: string) => Promise<string | null> {
    const cache = new Map<string, Promise<string | null>>()
    return (url: string) => {
        const cached = cache.get(url)
        if (cached) return cached
        const result = resolveOwidUrl(url, query)
        cache.set(url, result)
        result.catch(() => cache.delete(url))
        return result
    }
}

async function resolveOwidUrl(
    url: string,
    query: SqlQueryFn
): Promise<string | null> {
    let parsed: URL
    try {
        parsed = new URL(url.trim())
    } catch {
        return null
    }
    let path = pathFromOwidUrl(parsed)
    if (path === null) return null

    // Follow exact-match redirects. Wildcard redirect rules are not
    // evaluated — a URL that only resolves through one returns null.
    const seen = new Set<string>([path])
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
        const rows = (await query(
            "SELECT target FROM redirects WHERE source = ?",
            [`/${path}`]
        )) as Array<{ target: string }>
        if (rows.length === 0) break
        const target = rows[0].target.trim()
        let targetUrl: URL
        try {
            targetUrl = target.startsWith("/")
                ? new URL(`https://ourworldindata.org${target}`)
                : new URL(target)
        } catch {
            return null
        }
        const nextPath = pathFromOwidUrl(targetUrl)
        if (nextPath === null) return null
        if (seen.has(nextPath)) return null // redirect cycle
        seen.add(nextPath)
        path = nextPath
    }

    if (NON_GDOC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)))
        return null

    const { slug, types } = pathToGdocLookup(path)
    if (slug === "") return null

    const matches = (await query(
        `SELECT id FROM posts_gdocs WHERE slug = ? AND published = 1 AND type IN (${types.map(() => "?").join(",")})`,
        [slug, ...types]
    )) as Array<{ id: string }>

    // exactly one published gdoc, or we don't guess
    if (matches.length !== 1) return null
    return `https://docs.google.com/document/d/${matches[0].id}/edit`
}
