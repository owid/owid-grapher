import { useCallback, useMemo, useEffect } from "react"
import * as R from "remeda"
import { useSearchContext } from "./SearchContext.js"
import { getFilterIcon, getFilterSuggestionsNgrams } from "./searchUtils.js"
import { FilterType, ScoredFilterPositioned } from "./searchTypes.js"
import { SearchFilterPill } from "./SearchFilterPill.js"

/**
 * Detects potential country and topic filters from the search query using n-gram matching.
 * Automatically applies country filters while showing manual filter suggestions for topics.
 */
export const SearchDetectedFilters = ({
    allTopics,
}: {
    allTopics: string[]
}) => {
    const {
        state: { query, filters },
        actions: { replaceQueryWithFilters },
        synonymMap,
    } = useSearchContext()

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

    // Auto-apply country filters
    useEffect(() => {
        if (automaticFilters.length > 0) {
            applyFilters(automaticFilters)
        }
    }, [automaticFilters, applyFilters])

    if (!manualFilters.length) return null

    return (
        <div className="search-detected-filters">
            <span className="search-detected-filters__label">
                Did you mean?
            </span>

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
