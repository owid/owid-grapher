import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useState, useEffect, useCallback, useRef } from "react"
import { SearchInput } from "./SearchInput.js"
import { SearchActiveFilters } from "./SearchActiveFilters.js"
import { SearchAutocomplete } from "./SearchAutocomplete.js"
import { SearchCountrySelector } from "./SearchCountrySelector.js"
import { Filter, FilterType } from "./searchTypes.js"
import {
    createFocusInputOnClickHandler,
    getFilterNamesOfType,
} from "./searchUtils.js"
import { SearchAutocompleteContextProvider } from "./SearchAutocompleteContextProvider.js"
import { SearchResetButton } from "./SearchResetButton.js"

export const Searchbar = ({
    allTopics,
    filters,
    query,
    setQuery,
    addCountry,
    removeCountry,
    addTopic,
    removeTopic,
    requireAllCountries,
    toggleRequireAllCountries,
    reset,
}: {
    allTopics: string[]
    filters: Filter[]
    query: string
    setQuery: (query: string) => void
    addCountry: (country: string) => void
    removeCountry: (country: string) => void
    addTopic: (topic: string) => void
    removeTopic: (topic: string) => void
    requireAllCountries: boolean
    toggleRequireAllCountries: () => void
    reset: () => void
}) => {
    const selectedCountryNames = getFilterNamesOfType(
        filters,
        FilterType.COUNTRY
    )
    // Storing this in local state so that query params don't update during typing
    const [localQuery, setLocalQuery] = useState(query)
    // sync local query with global query when browser navigation occurs
    useEffect(() => {
        setLocalQuery(query)
    }, [query])

    const inputRef = useRef<HTMLInputElement>(null)

    const removeLastFilter = useCallback(() => {
        if (filters.length === 0) return

        const lastFilter = filters[filters.length - 1]
        if (lastFilter.type === FilterType.COUNTRY) {
            removeCountry(lastFilter.name)
        } else if (lastFilter.type === FilterType.TOPIC) {
            removeTopic(lastFilter.name)
        }
    }, [filters, removeCountry, removeTopic])

    const handleSearchBarClick = createFocusInputOnClickHandler(inputRef)

    return (
        <>
            <div className="search-bar" onClick={handleSearchBarClick}>
                <button
                    className="search-bar__submit-button"
                    aria-label="Submit search"
                    onClick={() => setQuery(localQuery)}
                >
                    <FontAwesomeIcon icon={faSearch} />
                </button>
                <SearchAutocompleteContextProvider>
                    <SearchInput
                        ref={inputRef}
                        value={localQuery}
                        setLocalQuery={setLocalQuery}
                        setGlobalQuery={setQuery}
                        onBackspaceEmpty={removeLastFilter}
                        resetButton={
                            <SearchResetButton
                                disabled={!(localQuery || filters.length)}
                                onReset={() => {
                                    setLocalQuery("")
                                    reset()
                                }}
                            />
                        }
                    >
                        <SearchActiveFilters
                            filters={filters}
                            removeCountry={removeCountry}
                            removeTopic={removeTopic}
                        />
                    </SearchInput>
                    <SearchAutocomplete
                        localQuery={localQuery}
                        allTopics={allTopics}
                        filters={filters}
                        setLocalQuery={setLocalQuery}
                        setQuery={setQuery}
                        addCountry={addCountry}
                        addTopic={addTopic}
                    />
                </SearchAutocompleteContextProvider>
                <SearchCountrySelector
                    requireAllCountries={requireAllCountries}
                    toggleRequireAllCountries={toggleRequireAllCountries}
                    selectedCountryNames={selectedCountryNames}
                    addCountry={addCountry}
                    removeCountry={removeCountry}
                />
            </div>
        </>
    )
}
