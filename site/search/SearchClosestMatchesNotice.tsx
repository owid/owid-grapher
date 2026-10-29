/**
 * Shown when a section displays relaxed ("closest matches") results because
 * the exact search returned nothing — see the closest-matches fallback in
 * queries.ts. Tells the user honestly that we don't have an exact answer,
 * while still offering the nearest content instead of a blank page.
 */
export function SearchClosestMatchesNotice() {
    return (
        <p className="search-closest-matches-notice">
            No results match all your search terms — showing the closest matches
            instead.
        </p>
    )
}
