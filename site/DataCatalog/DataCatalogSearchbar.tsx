import { Region } from "@ourworldindata/utils"
import { DataCatalogCountrySelector } from "./DataCatalogCountrySelector.js"
import { DataCatalogAutocomplete } from "./DataCatalogAutocomplete.js"
import {
    CatalogFilter,
    CatalogFilterType,
    QueryType,
    SearchRelaxationMode,
} from "./DataCatalogState.js"
import { DataCatalogAppliedFilters } from "./DataCatalogAppliedFilters.js"

export const DataCatalogSearchbar = ({
    query,
    setQuery,
    addFilter,
    removeFilter,
    requireAllCountries,
    selectedCountryNames,
    toggleRequireAllCountries,
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
    addFilter: (filter: CatalogFilter) => void
    removeFilter: (filter: CatalogFilter) => void
    requireAllCountries: boolean
    toggleRequireAllCountries: () => void
    searchRelaxationMode: SearchRelaxationMode
    queryType: QueryType
    typoTolerance: boolean
    minQueryLength: number
    filters: CatalogFilter[]
}) => {
    // Uses CSS to fake an input bar that will highlight correctly using :focus-within
    // without highlighting when the country selector is focused

    // TOOD: pending filters attempt not conclusive
    // const [pendingFilters, setPendingFilters] = useState<CatalogFilter[]>([])

    // useEffect(() => {
    //     setPendingFilters(filters)
    // }, [filters])

    // const addPendingFilter = (filter: CatalogFilter) => {
    //     setPendingFilters((prev) => [...prev, filter])
    // }

    // const upsertLastPendingFilter = (
    //     shouldAdd: boolean,
    //     filter: CatalogFilter
    // ) => {
    //     setPendingFilters((prev) => {
    //         const prevFilters = [...prev]
    //         if (!shouldAdd) {
    //             prevFilters.pop()
    //         }
    //         return [...prevFilters, filter]
    //     })
    // }

    // const removeLastPendingFilter = () => {
    //     setPendingFilters((prev) => {
    //         const prevFilters = [...prev]
    //         prevFilters.pop()
    //         return prevFilters
    //     })
    // }

    const upsertLastFilter = (shouldAdd: boolean, filter: CatalogFilter) => {
        if (!shouldAdd) {
            removeLastFilter()
        }
        addFilter(filter)
    }
    const removeLastFilter = () => {
        const lastFilter = filters[filters.length - 1]
        if (lastFilter) {
            removeFilter(lastFilter)
        }
    }

    return (
        <>
            <div className="data-catalog-pseudo-input">
                <DataCatalogAppliedFilters
                    filters={filters}
                    removeFilter={removeFilter}
                />
                <DataCatalogAutocomplete
                    placeholder="Search for data..."
                    className="data-catalog-search-box-container"
                    setQuery={setQuery}
                    query={query}
                    addFilter={addFilter}
                    upsertLastFilter={upsertLastFilter}
                    removeLastFilter={removeLastFilter}
                    pendingFilters={filters}
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
                addCountry={(country: string) => {
                    addFilter({
                        type: CatalogFilterType.COUNTRY,
                        name: country,
                    })
                }}
                removeCountry={(country: string) => {
                    removeFilter({
                        type: CatalogFilterType.COUNTRY,
                        name: country,
                    })
                }}
            />
        </>
    )
}
