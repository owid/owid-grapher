// Both newsletters are sent to the same Mailchimp audience (to different
// interest groups), so they share one public campaign archive. Its HTML
// listing covers the last ~20 sends, newest first; the RSS feed only has
// 10, which isn't always enough to include the latest twice-monthly Brief.
export const NEWSLETTER_ARCHIVE_URL =
    "https://us8.campaign-archive.com/home/?u=18058af086319ba6afad752ec&id=2e166c1fc1"

// We tell the newsletters apart by their campaign title prefix
const NEWSLETTER_TITLE_PREFIXES = {
    "owid-brief": "The OWID Brief",
    "data-insights": "Data Insight:",
} as const

export type NewsletterSlug = keyof typeof NEWSLETTER_TITLE_PREFIXES

export function isNewsletterSlug(slug: string): slug is NewsletterSlug {
    return Object.hasOwn(NEWSLETTER_TITLE_PREFIXES, slug)
}

const CAMPAIGN_LINK_REGEX =
    /<li class="campaign">[^<]*<a href="([^"]+)" title="([^"]*)"/g

function decodeHtmlAttribute(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
}

export function findLatestNewsletterEditionUrl(
    archiveHtml: string,
    newsletter: NewsletterSlug
): string | undefined {
    const prefix = NEWSLETTER_TITLE_PREFIXES[newsletter].toLowerCase()
    for (const [, href, title] of archiveHtml.matchAll(CAMPAIGN_LINK_REGEX)) {
        if (decodeHtmlAttribute(title).toLowerCase().startsWith(prefix)) {
            // The archive links to http:// eepurl.com short links
            return decodeHtmlAttribute(href).replace(/^http:\/\//, "https://")
        }
    }
    return undefined
}
