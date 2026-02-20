import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useState, useCallback, useRef } from "react"
import { SearchInput } from "./SearchInput.js"
import { SearchActiveFilters } from "./SearchActiveFilters.js"
import { SearchAutocomplete } from "./SearchAutocomplete.js"
import { SearchCountrySelector } from "./SearchCountrySelector.js"
import { FilterType } from "@ourworldindata/types"
import { createFocusInputOnClickHandler } from "./searchUtils.js"
import { SearchAutocompleteContextProvider } from "./SearchAutocompleteContextProvider.js"
import { SearchResetButton } from "./SearchResetButton.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedRegionNames } from "./searchHooks.js"

export const Searchbar = ({
    allTopics,
    autoFocus,
}: {
    allTopics: string[]
    autoFocus: boolean
}) => {
    const {
        state,
        actions: {
            setQuery,
            addCountry,
            removeCountry,
            removeTopic,
            toggleRequireAllCountries,
            reset,
            removeFilter,
        },
    } = useSearchContext()

    const { filters, query, requireAllCountries } = state

    const selectedRegionNames = useSelectedRegionNames()
    // Storing this in local state so that query params don't update during
    // typing. Whenever the state semantically changes, we update the local
    // query by triggering a re-mount (see key prop on Searchbar in parent
    // component).
    const [localQuery, setLocalQuery] = useState(query)

    const inputRef = useRef<HTMLInputElement>(null)

    const removeLastFilter = useCallback(() => {
        if (filters.length === 0) return

        const lastFilter = filters[filters.length - 1]
        if (lastFilter.type === FilterType.COUNTRY) {
            removeCountry(lastFilter.name)
        } else if (lastFilter.type === FilterType.TOPIC) {
            removeTopic(lastFilter.name)
        } else {
            removeFilter(lastFilter)
        }
    }, [filters, removeCountry, removeFilter, removeTopic])

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
                        autoFocus={autoFocus}
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
                    selectedRegionNames={selectedRegionNames}
                    addCountry={addCountry}
                    removeCountry={removeCountry}
                />
            </div>
        </>
    )
}
