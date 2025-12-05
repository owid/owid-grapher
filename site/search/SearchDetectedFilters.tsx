import { useCallback, useMemo, useEffect } from "react"
import { useSearchContext } from "./SearchContext.js"
import {
    getFilterIcon,
    extractFiltersFromQuery,
    getAutoFilters,
} from "./searchUtils.js"
import { FilterType, ScoredFilterPositioned } from "@ourworldindata/types"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { listedRegionsNames } from "@ourworldindata/utils"

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
        deferredState: { filters: deferredFilters, query: deferredQuery },
        actions: { replaceQueryWithFilters },
        synonymMap,
    } = useSearchContext()

    const allRegionNames = listedRegionsNames()

    const automaticFilters = useMemo(
        () =>
            getAutoFilters(
                query,
                allRegionNames,
                allTopics,
                filters,
                synonymMap
            ),
        [query, allRegionNames, allTopics, filters, synonymMap]
    )

    // Manual filter suggestions are parsed independently to give shorter exact
    // matches priority. Otherwise, a query like "north korea south korea" would
    // greedily match "south korea" on "korea south korea", leaving "north"
    // orphan. Use deferred state to avoid showing suggestions while automatic
    // filters are applied.
    const manualFilters = useMemo(() => {
        const matches = extractFiltersFromQuery(
            deferredQuery,
            allRegionNames,
            allTopics,
            deferredFilters,
            { threshold: 0.75, limit: 1 },
            synonymMap
        )
        // Only show non-exact country matches as suggestions
        return matches.filter((match) => match.type === FilterType.COUNTRY)
    }, [deferredQuery, allRegionNames, allTopics, deferredFilters, synonymMap])

    const applyFilters = useCallback(
        (filtersToProcess: ScoredFilterPositioned[]) => {
            if (filtersToProcess.length === 0) return

            // Collect all positions that need to be removed from the query
            const allPositions = filtersToProcess.flatMap(
                (filter) => filter.positions
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
