import cx from "classnames"
import { useEffect, useMemo, useCallback } from "react"
import { match } from "ts-pattern"
import {
    getAutocompleteSuggestionsWithUnmatchedQuery,
    useSearchAutocomplete,
    createQueryFilter,
} from "./searchUtils.js"
import { SearchAutocompleteItemContents } from "./SearchAutocompleteItemContents.js"
import { Filter, FilterType } from "./searchTypes.js"

// Default search suggestions to show when there's no query or filters
const DEFAULT_SEARCHES = [
    "gdp per capita",
    "co2 emissions",
    "life expectancy",
    "child mortality",
    "energy consumption",
]

export const SearchAutocomplete = ({
    localQuery,
    allTopics,
    filters,
    setLocalQuery,
    setQuery,
    addCountry,
    addTopic,
}: {
    localQuery: string
    allTopics: string[]
    filters: Filter[]
    setLocalQuery: (query: string) => void
    setQuery: (query: string) => void
    addCountry: (country: string) => void
    addTopic: (topic: string) => void
}) => {
    const { suggestions, unmatchedQuery } = useMemo(() => {
        if (!localQuery && !filters.length) {
            return {
                suggestions: DEFAULT_SEARCHES.map(createQueryFilter),
                unmatchedQuery: "",
            }
        }
        return getAutocompleteSuggestionsWithUnmatchedQuery(
            localQuery,
            allTopics,
            filters
        )
    }, [localQuery, allTopics, filters])

    const {
        activeIndex,
        setActiveIndex,
        setSuggestions,
        showSuggestions,
        setShowSuggestions,
        registerSelectionHandler,
    } = useSearchAutocomplete()

    const setQueries = useCallback(
        (query: string) => {
            setLocalQuery(query)
            setQuery(query)
        },
        [setLocalQuery, setQuery]
    )

    const handleSelection = useCallback(
        (filter: Filter) => {
            match(filter.type)
                // this setQueries logic must remain synchronized with the
                // presentation logic in SearchAutocompleteItemContents to ensure
                // unmatchedQuery is only displayed in the input field when it
                // should be preserved after filter selection
                .with(FilterType.COUNTRY, () => {
                    addCountry(filter.name)
                    setQueries(filters.length ? "" : unmatchedQuery)
                })
                .with(FilterType.TOPIC, () => {
                    addTopic(filter.name)
                    setQueries("")
                })
                .with(FilterType.QUERY, () => {
                    setQueries(filter.name)
                })
                .exhaustive()
            setShowSuggestions(false)
        },
        [
            addCountry,
            addTopic,
            setShowSuggestions,
            setQueries,
            unmatchedQuery,
            filters.length,
        ]
    )

    useEffect(() => {
        setSuggestions(suggestions)
    }, [suggestions, setSuggestions])

    // Register the selection handler with the context
    useEffect(() => {
        registerSelectionHandler(handleSelection)
    }, [handleSelection, registerSelectionHandler])

    if (!showSuggestions || !suggestions.length) return null

    return (
        <div className="search-autocomplete-container">
            <ul role="listbox">
                {suggestions.map((filter, index) => (
                    <li
                        key={filter.name}
                        className={cx("search-autocomplete-item", {
                            "search-autocomplete-item--active":
                                index === activeIndex,
                        })}
                        role="option"
                        aria-selected={index === activeIndex}
                    >
                        <button
                            id={`autocomplete-item-${index}`}
                            type="button"
                            className={cx("search-autocomplete-button", {
                                "search-autocomplete-button--active":
                                    index === activeIndex,
                            })}
                            onMouseDown={
                                // On mobile Safari, onBlur on the input doesn't
                                // register the e.relatedTarget coming from an
                                // onClick event on these buttons. So we use
                                // onMouseDown to get there before onBlur.
                                () => handleSelection(filter)
                            }
                            onMouseEnter={() => setActiveIndex(index)}
                        >
                            <SearchAutocompleteItemContents
                                filter={filter}
                                activeFilters={filters}
                                unmatchedQuery={unmatchedQuery}
                            />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
