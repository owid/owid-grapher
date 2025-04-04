import { Region } from "@ourworldindata/utils"
import { DataCatalogCountrySelector } from "./DataCatalogCountrySelector.js"
import { DataCatalogAutocomplete } from "./DataCatalogAutocomplete.js"
import {
    CatalogFilter,
    CatalogFilterType,
    QueryType,
    SearchRelaxationMode,
} from "./DataCatalogState.js"
import { AppliedFilters } from "./AppliedFilters.js"

export const DataCatalogSearchbar = ({
    query,
    setQuery,
    removeCountry,
    removeFilter,
    addCountry,
    requireAllCountries,
    selectedCountryNames,
    toggleRequireAllCountries,
    addTopic,
    searchRelaxationMode,
    queryType,
    typoTolerance,
    minQueryLength,
    filters,
}: {
    selectedCountries: Region[]
    selectedCountryNames: Set<string>
    query: string
    setQuery: (query: string) => void
    removeCountry: (country: string) => void
    removeFilter: (filterType: CatalogFilterType, name: string) => void
    addCountry: (country: string) => void
    requireAllCountries: boolean
    toggleRequireAllCountries: () => void
    addTopic: (topic: string) => void
    searchRelaxationMode: SearchRelaxationMode
    queryType: QueryType
    typoTolerance: boolean
    minQueryLength: number
    filters: CatalogFilter[]
}) => {
    // Uses CSS to fake an input bar that will highlight correctly using :focus-within
    // without highlighting when the country selector is focused
    return (
        <>
            <div className="data-catalog-pseudo-input">
                <AppliedFilters filters={filters} removeFilter={removeFilter} />
                <DataCatalogAutocomplete
                    placeholder="Search for data..."
                    className="data-catalog-search-box-container"
                    setQuery={setQuery}
                    query={query}
                    addCountry={addCountry}
                    addTopic={addTopic}
                    searchRelaxationMode={searchRelaxationMode}
                    queryType={queryType}
                    typoTolerance={typoTolerance}
                    minQueryLength={minQueryLength}
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
