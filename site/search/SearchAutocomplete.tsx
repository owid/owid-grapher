import cx from "classnames"
import { useMemo, useEffect } from "react"
import { AutocompleteItemContents } from "./AutocompleteItemContents.js"
import { useAutocomplete } from "./searchUtils.js"

export const SearchAutocomplete = ({
    localQuery,
    allTopics,
    selectedCountryNames,
    selectedTopics,
    query,
    setLocalQuery,
    setQuery,
    addCountry,
    addTopic,
}: {
    localQuery: string
    allTopics: string[]
    selectedCountryNames: Set<string>
    selectedTopics: Set<string>
    query: string
    setLocalQuery: (query: string) => void
    setQuery: (query: string) => void
    addCountry: (country: string) => void
    addTopic: (topic: string) => void
}) => {
    const items = useAutocomplete(localQuery, allTopics, {
        selectedCountryNames,
        selectedTopics,
    })
    const itemsToRender = useMemo(
        () => [{ name: localQuery, type: "query" }, ...items],
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
                ...document.querySelectorAll(
                    ".data-catalog-autocomplete-button"
                ),
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
    return (
        <div className="data-catalog-autocomplete-container">
            <ul>
                {itemsToRender.map(({ name, type }) => (
                    <li
                        key={name}
                        className={cx("data-catalog-autocomplete-item")}
                    >
                        <button
                            data-prevent-onblur
                            className="data-catalog-autocomplete-button"
                            onClick={() => {
                                const queryMinusLastWord = query
                                    .split(" ")
                                    .slice(0, -1)
                                    .join(" ")
                                if (type === "country") {
                                    addCountry(name)
                                }
                                if (type === "topic") {
                                    addTopic(name)
                                }
                                if (type === "query") {
                                    setLocalQuery(name)
                                    setQuery(name)
                                    ;(
                                        document.activeElement as HTMLElement
                                    ).blur()
                                    return
                                }
                                setLocalQuery(queryMinusLastWord)
                                setQuery(queryMinusLastWord)
                            }}
                        >
                            <AutocompleteItemContents type={type} name={name} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
