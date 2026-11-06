/**
 * The form a search takes when it's compared against the searches a page is
 * pinned for. The indexer, the clash checks and the site all compare in this
 * form, so a pinned search and a reader's search that should match always
 * compare equal.
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
