import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useState, useEffect, useCallback, useRef } from "react"
import { SearchInput } from "./SearchInput.js"
import { SearchActiveFilters } from "./SearchActiveFilters.js"
import { SearchAutocomplete } from "./SearchAutocomplete.js"
import { SearchCountrySelector } from "./SearchCountrySelector.js"
import { FilterType } from "./searchTypes.js"
import { createFocusInputOnClickHandler } from "./searchUtils.js"
import { SearchAutocompleteContextProvider } from "./SearchAutocompleteContextProvider.js"
import { SearchResetButton } from "./SearchResetButton.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedCountryNames } from "./searchHooks.js"

export const Searchbar = ({ allTopics }: { allTopics: string[] }) => {
    const {
        state: { filters, query, requireAllCountries },
        actions: {
            setQuery,
            addCountry,
            removeCountry,
            removeTopic,
            toggleRequireAllCountries,
            reset,
        },
    } = useSearchContext()

    const selectedCountryNames = useSelectedCountryNames()
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

    // Allow clicks on the search bar to focus the input. This is useful on
    // mobile when the search bar stretches vertically and reveals white space
    // readers might be clicking on. Do not register clicks on children, as we
    // don't want clicks on the country selector to focus the input.
    const handleSearchBarClick = createFocusInputOnClickHandler(inputRef, true)

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
                        <SearchActiveFilters />
                    </SearchInput>
                    <SearchAutocomplete
                        localQuery={localQuery}
                        allTopics={allTopics}
                        setLocalQuery={setLocalQuery}
                        setQuery={setQuery}
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
