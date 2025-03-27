import { Region, commafyNumber } from "@ourworldindata/utils"
import { ChartHit } from "../search/ChartHit.js"
import { analytics, DataCatalogSearchResult } from "./DataCatalogUtils.js"
import { DataCatalogPagination } from "./DataCatalogPagination.js"
import { DataCatalogNoResults } from "./DataCatalogNoResults.js"
import { DataCatalogResultsSkeleton } from "./DataCatalogSkeletons.js"
import { CatalogComponentStyle } from "./DataCatalogState.js"
import { ChartHitsTable } from "./ChartHitsTable.js"

export const DataCatalogResults = ({
    selectedCountries,
    results,
    setPage,
    isLoading,
    style,
}: {
    results?: DataCatalogSearchResult
    selectedCountries: Region[]
    setPage: (page: number) => void
    isLoading: boolean
    style: CatalogComponentStyle
}) => {
    if (isLoading) return <DataCatalogResultsSkeleton />

    const hits = results?.hits
    if (!hits || !hits.length) return <DataCatalogNoResults />

    const { page, nbPages, nbHits } = results
    return (
        <>
            <div
                className="span-cols-12 col-start-2 data-catalog-search-hits"
                style={{ marginTop: 32 }}
            >
                {nbHits && (
                    <p className="data-catalog-search-list__results-count body-3-medium">
                        {commafyNumber(nbHits)}{" "}
                        {nbHits === 1 ? "indicator" : "indicators"}
                    </p>
                )}
                {style === CatalogComponentStyle.GRID ? (
                    <ul className="data-catalog-search-list grid grid-cols-4 grid-sm-cols-1">
                        {hits.map((hit, i) => (
                            <li
                                className="data-catalog-search-hit"
                                key={hit.objectID}
                            >
                                <ChartHit
                                    onClick={() => {
                                        analytics.logDataCatalogResultClick(
                                            hit,
                                            i + 1,
                                            "search"
                                        )
                                    }}
                                    hit={hit}
                                    searchQueryRegionsMatches={
                                        selectedCountries
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <ChartHitsTable hits={hits} />
                )}
                <DataCatalogPagination
                    currentPage={page}
                    setPage={setPage}
                    nbPages={nbPages}
                />
            </div>
        </>
    )
}
