import * as cheerio from "cheerio"

export interface InternalLink {
    /** Decoded pathname, e.g. "/grapher/life-expectancy" */
    pathname: string
    /** Query string including the leading "?", or "" */
    search: string
    /** The href/src as it appeared in the HTML */
    raw: string
}

const URL_ATTRIBUTES: [selector: string, attribute: string][] = [
    ["a[href]", "href"],
    ["area[href]", "href"],
    ["link[href]", "href"],
    ["img[src]", "src"],
    ["img[srcset]", "srcset"],
    ["source[src]", "src"],
    ["source[srcset]", "srcset"],
    ["script[src]", "src"],
    ["iframe[src]", "src"],
    ["video[src]", "src"],
    ["video[poster]", "poster"],
    ["audio[src]", "src"],
    ["embed[src]", "src"],
    ["object[data]", "data"],
    ["form[action]", "action"],
    ["meta[property='og:image'][content]", "content"],
    ["meta[property='og:url'][content]", "content"],
    ["meta[name='twitter:image'][content]", "content"],
]

/** Hosts whose URLs are always treated as internal, in addition to the bake's base URL host. */
export const ALWAYS_INTERNAL_HOSTS = [
    "ourworldindata.org",
    "www.ourworldindata.org",
]

function parseSrcset(srcset: string): string[] {
    return srcset
        .split(",")
        .map((candidate) => candidate.trim().split(/\s+/)[0])
        .filter((url): url is string => !!url)
}

/**
 * Turns a raw href/src into an internal link, or undefined if it points
 * off-site (or isn't a navigable URL at all).
 */
export function toInternalLink(
    raw: string,
    baseUrl: URL,
    internalHosts: Set<string>
): InternalLink | undefined {
    const trimmed = raw.trim()
    if (!trimmed) return undefined
    // Same-page anchors and query-only links resolve to the current page.
    if (trimmed.startsWith("#") || trimmed.startsWith("?")) return undefined
    if (/^(mailto|tel|javascript|data|blob):/i.test(trimmed)) return undefined

    let url: URL
    try {
        url = new URL(trimmed, baseUrl)
    } catch {
        return undefined
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    if (!internalHosts.has(url.hostname)) return undefined

    let pathname = url.pathname
    try {
        pathname = decodeURIComponent(pathname)
    } catch {
        // Leave malformed percent-encoding as-is; it will most likely not resolve.
    }
    return { pathname, search: url.search, raw: trimmed }
}

export function extractInternalLinks(
    html: string,
    baseUrl: URL,
    internalHosts: Set<string> = new Set([
        baseUrl.hostname,
        ...ALWAYS_INTERNAL_HOSTS,
    ])
): InternalLink[] {
    const $ = cheerio.load(html)
    const links: InternalLink[] = []
    for (const [selector, attribute] of URL_ATTRIBUTES) {
        $(selector).each((_, element) => {
            const value = $(element).attr(attribute)
            if (!value) return
            const candidates =
                attribute === "srcset" ? parseSrcset(value) : [value]
            for (const candidate of candidates) {
                const link = toInternalLink(candidate, baseUrl, internalHosts)
                if (link) links.push(link)
            }
        })
    }
    return links
}
