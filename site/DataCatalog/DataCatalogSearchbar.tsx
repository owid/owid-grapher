import { Region } from "@ourworldindata/utils"
import { SelectedCountriesPills } from "./SelectedCountriesPills.js"
import { DataCatalogCountrySelector } from "./DataCatalogCountrySelector.js"
import { DataCatalogAutocomplete } from "./DataCatalogAutocomplete.js"
import { QueryType, SearchRelaxationMode } from "./DataCatalogState.js"

export const DataCatalogSearchbar = ({
    selectedCountries,
    query,
    setQuery,
    removeCountry,
    addCountry,
    requireAllCountries,
    selectedCountryNames,
    toggleRequireAllCountries,
    addTopic,
    searchRelaxationMode,
    queryType,
}: {
    selectedCountries: Region[]
    selectedCountryNames: Set<string>
    query: string
    setQuery: (query: string) => void
    removeCountry: (country: string) => void
    addCountry: (country: string) => void
    requireAllCountries: boolean
    toggleRequireAllCountries: () => void
    addTopic: (topic: string) => void
    searchRelaxationMode: SearchRelaxationMode
    queryType: QueryType
}) => {
    // Uses CSS to fake an input bar that will highlight correctly using :focus-within
    // without highlighting when the country selector is focused
    return (
        <>
            <div className="data-catalog-pseudo-input">
                <SelectedCountriesPills
                    selectedCountries={selectedCountries}
                    removeCountry={removeCountry}
                />
                <DataCatalogAutocomplete
                    placeholder="Search for data..."
                    className="data-catalog-search-box-container"
                    setQuery={setQuery}
                    query={query}
                    addCountry={addCountry}
                    addTopic={addTopic}
                    searchRelaxationMode={searchRelaxationMode}
                    queryType={queryType}
                />
            </div>
            <DataCatalogCountrySelector
                requireAllCountries={requireAllCountries}
                toggleRequireAllCountries={toggleRequireAllCountries}
                selectedCountryNames={selectedCountryNames}
                addCountry={addCountry}
                removeCountry={removeCountry}
            />
        </>
    )
}
