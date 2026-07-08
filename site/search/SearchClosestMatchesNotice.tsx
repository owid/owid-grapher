import { useSearchContext } from "./SearchContext.js"

/**
 * Shown when a section displays relaxed ("closest matches") results because
 * the exact search returned nothing — see the closest-matches fallback in
 * queries.ts. Tells the user honestly that we don't have an exact answer,
 * while still offering the nearest content instead of a blank page.
 */
export function SearchClosestMatchesNotice() {
    const { state } = useSearchContext()
    return (
        <p
            className="search-closest-matches-notice body-3-medium"
            style={{
                margin: "0 0 16px",
                padding: "8px 12px",
                background: "#f7f8fa",
                border: "1px solid #e4e8ec",
                borderRadius: 6,
                color: "#5b5e63",
            }}
        >
            No exact matches for <strong>“{state.query}”</strong> — showing the
            closest matches instead.
        </p>
    )
}
