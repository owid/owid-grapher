import cx from "classnames"
import { useEffect, useMemo, useCallback } from "react"
import { match } from "ts-pattern"
import {
    getAutocompleteSuggestions,
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
    const queryMinusLastWord = localQuery.split(" ").slice(0, -1).join(" ")
    const items = useMemo(() => {
        if (!localQuery && !filters.length) {
            return DEFAULT_SEARCHES.map(createQueryFilter)
        }
        return getAutocompleteSuggestions(localQuery, allTopics, filters)
    }, [localQuery, allTopics, filters])

    const {
        activeIndex,
        setActiveIndex,
        setSuggestions,
        isOpen,
        setIsOpen,
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
                .with(FilterType.COUNTRY, () => {
                    addCountry(filter.name)
                    setQueries(queryMinusLastWord)
                })
                .with(FilterType.TOPIC, () => {
                    addTopic(filter.name)
                    setQueries(queryMinusLastWord)
                })
                .with(FilterType.QUERY, () => {
                    setQueries(filter.name)
                })
                .exhaustive()
            setIsOpen(false)
        },
        [addCountry, addTopic, queryMinusLastWord, setIsOpen, setQueries]
    )

    useEffect(() => {
        setSuggestions(items)
    }, [items, setSuggestions])

    // Register the selection handler with the context
    useEffect(() => {
        registerSelectionHandler(handleSelection)
    }, [handleSelection, registerSelectionHandler])

    if (!isOpen) return null

    return (
        <div className="search-autocomplete-container">
            <ul role="listbox">
                {items.map((filter, index) => (
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
                            data-prevent-onblur
                            type="button"
                            className={cx("search-autocomplete-button", {
                                "search-autocomplete-button--active":
                                    index === activeIndex,
                            })}
                            onClick={() => handleSelection(filter)}
                            onMouseEnter={() => setActiveIndex(index)}
                        >
                            <SearchAutocompleteItemContents
                                filter={filter}
                                baseQuery={queryMinusLastWord}
                                activeFilters={filters}
                            />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
