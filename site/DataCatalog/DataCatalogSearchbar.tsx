import { Region } from "@ourworldindata/utils"
import { SelectedCountriesPills } from "./SelectedCountriesPills.js"
import { DataCatalogCountrySelector } from "./DataCatalogCountrySelector.js"
import { DataCatalogAutocomplete } from "./DataCatalogAutcomplete.js"

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
