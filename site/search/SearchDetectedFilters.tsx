import { useCallback, useMemo, useEffect, useState } from "react"
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

    const queryWords = useMemo(() => query.trim().split(/\s+/), [query])

    const [appliedFilters, setAppliedFilters] = useState<{
        filters: ScoredFilterPositioned[]
        originalQuery: string
    } | null>(null)

    const allMatchedFilters = useMemo(() => {
        return getFilterSuggestionsNgrams(
            queryWords,
            allTopics,
            filters,
            synonymMap
        )
    }, [queryWords, allTopics, filters, synonymMap])

    const [automaticFilters, manualFilters] = useMemo(() => {
        return R.partition(
            allMatchedFilters,
            (filter) => filter.type === FilterType.COUNTRY
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
        if (!appliedFilters) return

        // Use atomic operation to remove filters and add query text.
        // Append the query as a quoted string to trigger Algolia's
        // phrase matching.
        replaceFiltersWithQuery(
            appliedFilters.filters,
            `"${appliedFilters.originalQuery}"`
        )

        setAppliedFilters(null)
    }, [appliedFilters, replaceFiltersWithQuery])

    // Auto-apply country filters and store them with original query
    useEffect(() => {
        if (automaticFilters.length === 0) return

        // Store all the country filters with the entire original query (once)
        setAppliedFilters({
            filters: automaticFilters,
            originalQuery: query,
        })
        applyFilters(automaticFilters)
    }, [automaticFilters, applyFilters, query])

    if (!manualFilters.length && !appliedFilters) return null

    return (
        <div className="search-detected-filters">
            <span className="search-detected-filters__label">
                Did you mean?
            </span>

            {appliedFilters && (
                <button
                    type="button"
                    onClick={handleRevertAppliedFilters}
                    className="search-detected-filter-button"
                >
                    <span className="search-quoted-phrase">
                        "
                        <span className="search-quoted-phrase__underlined">
                            {appliedFilters.originalQuery}
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
