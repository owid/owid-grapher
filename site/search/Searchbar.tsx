import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useState, useEffect } from "react"
import { SearchInput } from "./SearchInput.js"
import { SearchActiveFilters } from "./SearchActiveFilters.js"
import { SearchAutocomplete } from "./SearchAutocomplete.js"
import { SearchCountrySelector } from "./SearchCountrySelector.js"
import { Filter, FilterType } from "./searchTypes.js"
import { getFilterNamesOfType } from "./searchUtils.js"
import { SearchAutocompleteContextProvider } from "./SearchAutocompleteContextProvider.js"

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

    return (
        <SearchAutocompleteContextProvider>
            <div className="search-bar">
                <button
                    className="search-bar__submit-button"
                    aria-label="Submit search"
                    onClick={() => setQuery(localQuery)}
                >
                    <FontAwesomeIcon icon={faSearch} />
                </button>
                <SearchActiveFilters
                    filters={filters}
                    removeCountry={removeCountry}
                    removeTopic={removeTopic}
                />
                <SearchInput
                    value={localQuery}
                    setLocalQuery={setLocalQuery}
                    setGlobalQuery={setQuery}
                />
                <SearchAutocomplete
                    localQuery={localQuery}
                    allTopics={allTopics}
                    filters={filters}
                    setLocalQuery={setLocalQuery}
                    setQuery={setQuery}
                    addCountry={addCountry}
                    addTopic={addTopic}
                />
            </div>
            <SearchCountrySelector
                requireAllCountries={requireAllCountries}
                toggleRequireAllCountries={toggleRequireAllCountries}
                selectedCountryNames={selectedCountryNames}
                addCountry={addCountry}
                removeCountry={removeCountry}
            />
        </SearchAutocompleteContextProvider>
    )
}
