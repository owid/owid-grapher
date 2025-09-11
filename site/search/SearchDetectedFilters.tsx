import { useCallback, useMemo } from "react"
import { useSearchContext } from "./SearchContext.js"
import {
    getFilterIcon,
    getFilterSuggestionsWithUnmatchedQueryNgrams,
    removeMatchedWordsWithStopWords,
} from "./searchUtils.js"
import { FilterType, ScoredFilterPositioned } from "./searchTypes.js"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { match } from "ts-pattern"

export const SearchDetectedFilters = ({
    allTopics,
}: {
    allTopics: string[]
}) => {
    const {
        state: { query, filters },
        actions: { setQuery, addCountry, setTopic },
        synonymMap,
    } = useSearchContext()

    const queryWords = query.trim().split(/\s+/)

    // Handler to remove matched words from query when clicking on a filter pill
    const handleFilterClick = useCallback(
        (filter: ScoredFilterPositioned) => {
            const newQuery = removeMatchedWordsWithStopWords(
                queryWords,
                filter.originalPositions
            )
            setQuery(newQuery)

            match(filter.type)
                .with(FilterType.COUNTRY, () => {
                    addCountry(filter.name)
                })
                .with(FilterType.TOPIC, () => {
                    setTopic(filter.name)
                })
                .with(FilterType.QUERY, () => {
                    // no-op
                })
                .exhaustive()
        },
        [queryWords, setQuery, addCountry, setTopic]
    )

    const matchedFilters = useMemo(() => {
        return getFilterSuggestionsWithUnmatchedQueryNgrams(
            queryWords,
            allTopics,
            filters,
            synonymMap
        )
    }, [query, allTopics, filters, synonymMap])

    if (!matchedFilters.length) return null

    return (
        <div className="search-detected-filters">
            <span className="search-detected-filters__label">
                Did you mean?
            </span>
            {matchedFilters.map((filter, i) => (
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
