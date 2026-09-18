import { useCallback, useMemo } from "react"
import { useSearchContext } from "./SearchContext.js"
import {
    buildFilterTestId,
    getFilterIcon,
    extractFiltersFromQuery,
} from "./searchUtils.js"
import { FilterType, ScoredFilterPositioned } from "@ourworldindata/types"
import { countriesByName } from "@ourworldindata/utils"
import { SearchFilterPill } from "./SearchFilterPill.js"

/**
 * Once a user commits a search query, we attempt to detect any (country)
 * filters that may apply to the query. Exact matches are applied transparently
 * in useSearchParamsState. Non-exact matches are shown through "Did you mean?"
 * filter suggestions below the search bar, which the user can click to manually
 * apply.
 */
export const SearchDetectedFilters = ({
    eligibleRegionNames,
}: {
    eligibleRegionNames: string[]
}) => {
    const {
        state: { filters, query },
        actions: { replaceQueryWithFilter },
        synonymMap,
        analytics,
    } = useSearchContext()

    // Manual filter suggestions are parsed independently to give shorter exact
    // matches priority. Otherwise, a query like "north korea south korea" would
    // greedily match "south korea" on "korea south korea", leaving "north"
    // orphan.
    const manualFilters = useMemo(() => {
        const matches = extractFiltersFromQuery(
            query,
            eligibleRegionNames,
            [], // do not suggest topics here
            filters,
            { threshold: 0.75, limit: 1 },
            synonymMap
        )
        return matches.filter(
            (match) =>
                // Only show non-exact country matches as suggestions
                match.type === FilterType.COUNTRY &&
                // Matching runs against every region so that a longer region
                // name stops the iteration ("East Germany" found, so "Germany"
                // isn't), but a historical state is a poor guess at what
                // someone meant -- "share of people who are undernourished"
                // suggested "Yemen People's Republic". The autocomplete
                // suggestions are filtered the same way.
                countriesByName()[match.name]
        )
    }, [query, eligibleRegionNames, filters, synonymMap])

    const handleFilterClick = useCallback(
        (filter: ScoredFilterPositioned) => {
            analytics.logSearchDetectedFilterClick({
                query,
                filterName: filter.name,
                filterType: filter.type,
            })
            // Apply the filter with positions information to handle word removal
            replaceQueryWithFilter(filter)
        },
        [replaceQueryWithFilter, analytics, query]
    )

    if (!manualFilters.length) return null

    return (
        <div
            className="search-detected-filters"
            data-testid="search-detected-filters"
        >
            <span
                className="search-detected-filters__label"
                data-testid="search-detected-filters-label"
            >
                Did you mean?
            </span>

            {manualFilters.map((filter, i) => (
                <button
                    type="button"
                    onClick={() => handleFilterClick(filter)}
                    key={i}
                    className="search-detected-filter-button"
                    data-testid={buildFilterTestId(
                        "search-detected-filter-button",
                        filter.type,
                        filter.name
                    )}
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
