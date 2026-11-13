import type { PageRecord } from "@ourworldindata/types"

/**
 * The pages-index attribute holding the searches a featured viz is pinned
 * for. The site filters on it, and the cached-queries proxy looks for it to
 * keep those requests out of its cache, so both must use this constant.
 */
export const PINNED_SEARCHES_ATTRIBUTE =
    "pinnedForSearches" satisfies keyof PageRecord

/**
 * The form a search takes when it's compared against the searches a page is
 * pinned for. The indexer, the clash checks and the site all compare in this
 * form, so a pinned search and a reader's search that should match always
 * compare equal.
 *
 * The Metabase question "Top site searches, last 12 months"
 * (http://metabase.owid.io/question/2017) uses the same regexes in SQL to
 * suggest pins for the suggest-pinned-searches skill. If you change this,
 * update that query too. If the two drift, the SQL must never clean up more
 * than this function: it would suggest pins that no search normalizes to.
 */
export function normalizePinnedSearch(search: string): string {
    return search
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
}

/**
 * Parses authored pinned searches: a comma-separated line, or an ArchieML
 * list (`[pinned-for-searches]` with `* item` lines). Both end up normalized.
 */
export function parsePinnedSearches(value: string | unknown[]): string[] {
    const items = typeof value === "string" ? value.split(",") : value
    const searches = items
        .filter((item): item is string => typeof item === "string")
        .map(normalizePinnedSearch)
    return [...new Set(searches.filter((search) => search !== ""))]
}
