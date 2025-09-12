import { useCallback, useMemo, useEffect } from "react"
import { useSearchContext } from "./SearchContext.js"
import { getFilterIcon, getFilterSuggestionsNgrams } from "./searchUtils.js"
import { FilterType, ScoredFilterPositioned } from "./searchTypes.js"
import { SearchFilterPill } from "./SearchFilterPill.js"

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

    const queryWords = useMemo(() => query.trim().split(/\s+/), [query])

    // Helper function to process filters and update query
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

    // Handler to apply filter when clicking on a filter pill
    const handleFilterClick = useCallback(
        (filter: ScoredFilterPositioned) => {
            applyFilters([filter])
        },
        [applyFilters]
    )

    const matchedFilters = useMemo(() => {
        return getFilterSuggestionsNgrams(
            queryWords,
            allTopics,
            filters,
            synonymMap
        )
    }, [queryWords, allTopics, filters, synonymMap])

    // Auto-apply country filters
    useEffect(() => {
        const countryFilters = matchedFilters.filter(
            (filter) => filter.type === FilterType.COUNTRY
        )

        if (countryFilters.length === 0) return

        applyFilters(countryFilters)
    }, [matchedFilters, applyFilters])

    const visibleFilters = matchedFilters.filter(
        (filter) => filter.type !== FilterType.COUNTRY
    )

    if (!visibleFilters.length) return null

    return (
        <div className="search-detected-filters">
            <span className="search-detected-filters__label">
                Did you mean?
            </span>
            {visibleFilters.map((filter, i) => (
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
