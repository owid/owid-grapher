import cx from "classnames"
import { useEffect, useMemo, useCallback } from "react"
import { match } from "ts-pattern"
import {
    getAutocompleteSuggestions,
    useSearchAutocomplete,
} from "./searchUtils.js"
import { SearchAutocompleteItemContents } from "./SearchAutocompleteItemContents.js"
import { Filter, FilterType } from "./searchTypes.js"

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
    const items = useMemo(
        () => getAutocompleteSuggestions(localQuery, allTopics, filters),
        [localQuery, allTopics, filters]
    )

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
                    setIsOpen(false)
                })
                .exhaustive()
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

    useEffect(() => {
        setIsOpen(!!localQuery)
    }, [localQuery, setIsOpen])

    // This effectively closes the autocomplete when the query is empty
    if (!localQuery || !isOpen) return null

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
