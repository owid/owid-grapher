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

/** Parses an authored comma-separated list of pinned searches. */
export function parsePinnedSearches(value: string): string[] {
    const searches = value.split(",").map(normalizePinnedSearch)
    return [...new Set(searches.filter((search) => search !== ""))]
}
