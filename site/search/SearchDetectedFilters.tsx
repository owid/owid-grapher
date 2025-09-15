import { useCallback, useMemo, useEffect, useState, useRef } from "react"
import * as R from "remeda"
import { useSearchContext } from "./SearchContext.js"
import { getFilterIcon, getFilterSuggestionsNgrams } from "./searchUtils.js"
import { FilterType, ScoredFilterPositioned } from "./searchTypes.js"
import { SearchFilterPill } from "./SearchFilterPill.js"

/**
 * Detects potential country and topic filters from the search query using n-gram matching.
 * Automatically applies country filters while showing manual filter suggestions for topics.
 * Applied country filters can be reverted back to their original quoted text.
 */
export const SearchDetectedFilters = ({
    allTopics,
}: {
    allTopics: string[]
}) => {
    const {
        state: { query, filters },
        actions: { replaceQueryWithFilters, replaceFiltersWithQuery },
        synonymMap,
    } = useSearchContext()

    const [automaticFiltersApplied, setAutomaticFiltersApplied] = useState<{
        filters: ScoredFilterPositioned[]
        originalQuery: string
    } | null>(null)

    // Track when query changes are system-initiated vs user-initiated
    const isQueryModifiedBySystem = useRef(false)
    const previousQueryRef = useRef(query)

    const allMatchedFilters = useMemo(() => {
        return getFilterSuggestionsNgrams(query, allTopics, filters, synonymMap)
    }, [query, allTopics, filters, synonymMap])

    const [automaticFilters, manualFilters] = useMemo(() => {
        return R.partition(
            allMatchedFilters,
            // only auto-apply exact country matches. Exact topic matches can be
            // ambiguous, e.g. matching the "Energy" topic for a "solar energy"
            // query might not be what the user intended.
            (filter) => filter.type === FilterType.COUNTRY && filter.score === 1
        )
    }, [allMatchedFilters])

    const applyFilters = useCallback(
        (filtersToProcess: ScoredFilterPositioned[]) => {
            if (filtersToProcess.length === 0) return

            // Collect all positions that need to be removed from the query
            const allPositions = filtersToProcess.flatMap(
                (filter) => filter.originalPositions
            )

            // Apply all filters at once, passing positions to let reducer handle word removal
            replaceQueryWithFilters(filtersToProcess, allPositions)
        },
        [replaceQueryWithFilters]
    )

    const handleFilterClick = useCallback(
        (filter: ScoredFilterPositioned) => {
            applyFilters([filter])
        },
        [applyFilters]
    )

    const handleRevertAppliedFilters = useCallback(() => {
        if (!automaticFiltersApplied) return

        // Mark this as a system-initiated query change
        isQueryModifiedBySystem.current = true

        // Use atomic operation to remove filters and add query text.
        // Append the query as a quoted string to trigger Algolia's
        // phrase matching.
        replaceFiltersWithQuery(
            automaticFiltersApplied.filters,
            `"${automaticFiltersApplied.originalQuery}"`
        )

        setAutomaticFiltersApplied(null)
    }, [automaticFiltersApplied, replaceFiltersWithQuery])

    // Auto-apply country filters and store them with original query.
    // Handle all query-related changes in a single effect to avoid race conditions.
    useEffect(() => {
        const currentQuery = query
        const previousQuery = previousQueryRef.current

        // Update ref for next comparison
        previousQueryRef.current = currentQuery

        // If system is modifying the query, reset flag and don't interfere
        if (isQueryModifiedBySystem.current) {
            isQueryModifiedBySystem.current = false
            return
        }

        // User-initiated query change: clear any existing applied filters
        if (previousQuery !== currentQuery && automaticFiltersApplied) {
            setAutomaticFiltersApplied(null)
        }

        // Check if we should auto-apply new automatic filters
        if (automaticFilters.length > 0) {
            isQueryModifiedBySystem.current = true

            setAutomaticFiltersApplied({
                filters: automaticFilters,
                originalQuery: currentQuery,
            })
            applyFilters(automaticFilters)
        }
    }, [query, automaticFilters, automaticFiltersApplied, applyFilters])

    if (!automaticFiltersApplied && !manualFilters.length) return null

    return (
        <div className="search-detected-filters">
            <span className="search-detected-filters__label">
                Did you mean?
            </span>

            {automaticFiltersApplied && (
                <button
                    type="button"
                    onClick={handleRevertAppliedFilters}
                    className="search-detected-filter-button"
                >
                    <span className="search-quoted-phrase">
                        "
                        <span className="search-quoted-phrase__underlined">
                            {automaticFiltersApplied.originalQuery}
                        </span>
                        "
                    </span>
                </button>
            )}
            {automaticFiltersApplied && manualFilters.length > 0 && (
                <span className="search-detected-filters__label">or</span>
            )}
            {manualFilters.map((filter, i) => (
                <button
                    type="button"
                    onClick={() => handleFilterClick(filter)}
                    key={i}
                    className="search-detected-filter-button"
                >
                    <SearchFilterPill
                        icon={getFilterIcon(filter)}
                        name={filter.name}
                        interactive={true}
                    />
                </button>
            ))}
        </div>
    )
}
