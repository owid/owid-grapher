import cx from "classnames"
import { useMemo, useEffect } from "react"
import { match } from "ts-pattern"
import { useAutocomplete } from "./searchUtils.js"
import { SearchAutocompleteItemContents } from "./SearchAutocompleteItemContents.js"
import { Filter, FilterType } from "./searchTypes.js"

export const SearchAutocomplete = ({
    localQuery,
    allTopics,
    filters,
    query,
    setLocalQuery,
    setQuery,
    addCountry,
    addTopic,
}: {
    localQuery: string
    allTopics: string[]
    filters: Filter[]
    query: string
    setLocalQuery: (query: string) => void
    setQuery: (query: string) => void
    addCountry: (country: string) => void
    addTopic: (topic: string) => void
}) => {
    const items = useAutocomplete(localQuery, allTopics, filters)
    const itemsToRender = useMemo(
        () => [{ name: localQuery, type: FilterType.QUERY }, ...items],
        [localQuery, items]
    )

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key
            const input = document.querySelector(
                ".data-catalog-search-input"
            ) as HTMLInputElement
            const pseudoinput = document.querySelector(
                ".data-catalog-pseudo-input:focus-within"
            ) as HTMLInputElement
            if (!pseudoinput) {
                return
            }
            const focusableItems = [
                ...document.querySelectorAll(".search-autocomplete-button"),
            ] as HTMLElement[]
            const currentIndex = document.activeElement
                ? focusableItems.indexOf(document.activeElement as HTMLElement)
                : null

            switch (key) {
                case "ArrowDown":
                    e.preventDefault()
                    if (currentIndex === null) {
                        focusableItems[0].focus()
                    } else if (currentIndex < itemsToRender.length - 1) {
                        focusableItems[currentIndex + 1].focus()
                    }
                    break
                case "ArrowUp":
                    e.preventDefault()
                    if (currentIndex === null) {
                        focusableItems[0].focus()
                    } else if (currentIndex > 0) {
                        focusableItems[currentIndex - 1].focus()
                    } else if (currentIndex === 0) {
                        input.focus()
                    }
                    break
                case "Escape":
                    e.preventDefault()
                    ;(document.activeElement as HTMLElement).blur()
                    break
            }
        }

        document.addEventListener("keydown", handleKeyDown)

        return () => {
            document.removeEventListener("keydown", handleKeyDown)
        }
    }, [
        items,
        itemsToRender,
        addCountry,
        addTopic,
        setLocalQuery,
        setQuery,
        query,
    ])

    if (!localQuery) return null

    const queryMinusLastWord = localQuery.split(" ").slice(0, -1).join(" ")

    const setQueries = (query: string) => {
        setLocalQuery(query)
        setQuery(query)
    }

    return (
        <div className="search-autocomplete-container">
            <ul>
                {itemsToRender.map((filter) => (
                    <li
                        key={filter.name}
                        className={cx("search-autocomplete-item")}
                    >
                        <button
                            data-prevent-onblur
                            className="search-autocomplete-button"
                            onClick={() => {
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
                                        ;(
                                            document.activeElement as HTMLElement
                                        ).blur()
                                        return
                                    })
                                    .exhaustive()
                            }}
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
