import cx from "classnames"
import { useEffect, useMemo, useCallback } from "react"
import { match } from "ts-pattern"
import {
    getFilterSuggestionsWithUnmatchedQuery,
    createQueryFilter,
    getSearchAutocompleteId,
    getSearchAutocompleteItemId,
    getFilterAriaLabel,
} from "./searchUtils.js"
import { useSearchAutocomplete } from "./SearchAutocompleteContext.js"
import { SearchAutocompleteItemContents } from "./SearchAutocompleteItemContents.js"
import { Filter, FilterType } from "./searchTypes.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { useSearchContext } from "./SearchContext.js"

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
    setLocalQuery,
    setQuery,
}: {
    localQuery: string
    allTopics: string[]
    setLocalQuery: (query: string) => void
    setQuery: (query: string) => void
}) => {
    const {
        state: { filters },
        actions: { addCountry, setTopic },
        synonymMap,
    } = useSearchContext()

    const analytics = useMemo(() => new SiteAnalytics(), [])

    const { suggestions, unmatchedQuery } = useMemo(() => {
        if (!localQuery && !filters.length) {
            return {
                suggestions: DEFAULT_SEARCHES.map(createQueryFilter),
                unmatchedQuery: "",
            }
        }
        return getFilterSuggestionsWithUnmatchedQuery(
            localQuery,
            allTopics,
            filters,
            synonymMap
        )
    }, [localQuery, allTopics, filters, synonymMap])

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
        (filter: Filter, index: number) => {
            const logSearchAutocompleteClick = () => {
                analytics.logSearchAutocompleteClick({
                    query: localQuery,
                    position: index,
                    filterType: filter.type,
                    filterName: filter.name,
                    suggestions: suggestions.map((s) => s.name),
                    suggestionsTypes: suggestions.map((s) => s.type),
                    suggestionsCount: suggestions.length,
                })
            }

            match(filter.type)
                // What readers see in each autocomplete suggestion is decoupled
                // from what happens when they click on one:
                // - display logic: SearchAutocompleteItemContents (1)
                // - handling logic: below 👇 (2)
                //
                // For instance, when searching for "co2 france", we detect:
                // - "france" as a country filter
                //     - and show "france" as a filter pill (SearchFilterPill in 1)
                //     - and add "france" to the active filters (addCountry in 2)
                // - "co2" as the unmatchedQuery
                //    - and show "co2" as the unmatched query (unmatchedQuery in 1)
                //    - and set the queries to "co2" (setQueries in 2)
                //
                // This symmetry between display and handling logic needs to be
                // manually maintained. If you change the handling logic, make
                // sure to also update the display logic accordingly (and vice
                // versa).
                .with(FilterType.COUNTRY, () => {
                    logSearchAutocompleteClick()
                    addCountry(filter.name)
                    setQueries(unmatchedQuery)
                })
                .with(FilterType.TOPIC, () => {
                    logSearchAutocompleteClick()
                    setTopic(filter.name)
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
            setTopic,
            setShowSuggestions,
            setQueries,
            unmatchedQuery,
            analytics,
            localQuery,
            suggestions,
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
            <ul id={getSearchAutocompleteId()} role="listbox">
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
                            id={getSearchAutocompleteItemId(index)}
                            type="button"
                            className={cx("search-autocomplete-button", {
                                "search-autocomplete-button--active":
                                    index === activeIndex,
                            })}
                            // Prevent tabbing into the dropdown. On Firefox,
                            // tabbing out of the input moves the focus to the
                            // dropdown as it is being discarded, resetting the
                            // focus to the body instead of the next interactive
                            // element.
                            tabIndex={-1}
                            onMouseDown={
                                // On mobile Safari, onBlur on the input doesn't
                                // register the e.relatedTarget coming from an
                                // onClick event on these buttons. So we use
                                // onMouseDown to get there before onBlur.
                                () => handleSelection(filter, index)
                            }
                            onMouseEnter={() => setActiveIndex(index)}
                            aria-label={getFilterAriaLabel(filter, "add")}
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
