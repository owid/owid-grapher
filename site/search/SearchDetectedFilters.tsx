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

    const [automaticFiltersWithWords, setAutomaticFiltersWithWords] = useState<
        { filter: ScoredFilterPositioned; originalWords: string }[]
    >([])

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

    const handleRemoveAllAppliedFilters = useCallback(() => {
        // Get all the filters to remove
        const filtersToRemove = automaticFiltersWithWords.map((item) => ({
            type: item.filter.type,
            name: item.filter.name,
        }))

        const allOriginalWords = automaticFiltersWithWords
            .map((item) => item.originalWords)
            .join(" ")

        // Use atomic operation to remove filters and add query text.
        // Append the query as a quoted string to trigger Algolia's
        // phrase matching.
        replaceFiltersWithQuery(filtersToRemove, `"${allOriginalWords}"`)

        setAutomaticFiltersWithWords([])
    }, [automaticFiltersWithWords, replaceFiltersWithQuery])

    // Auto-apply country filters and store them with original words
    useEffect(() => {
        if (automaticFilters.length === 0) return

        // Store the country filters with their original words before applying them
        const filtersWithWords = automaticFilters.map((filter) => ({
            filter,
            originalWords: filter.originalPositions
                .map((pos) => queryWords[pos])
                .join(" "),
        }))

        setAutomaticFiltersWithWords(filtersWithWords)
        applyFilters(automaticFilters)
    }, [automaticFilters, applyFilters, queryWords])

    if (!manualFilters.length && !automaticFiltersWithWords.length) return null

    return (
        <div className="search-detected-filters">
            <span className="search-detected-filters__label">
                Did you mean?
            </span>

            {automaticFiltersWithWords.length > 0 && (
                <button
                    type="button"
                    onClick={handleRemoveAllAppliedFilters}
                    className="search-detected-filter-button"
                >
                    <span className="search-quoted-phrase">
                        "
                        <span className="search-quoted-phrase__underlined">
                            {automaticFiltersWithWords
                                .map((item) => item.originalWords)
                                .join(" ")}
                        </span>
                        "
                    </span>
                </button>
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
