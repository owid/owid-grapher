import { Region, commafyNumber } from "@ourworldindata/utils"
import * as React from "react"
import { ChartHit } from "../search/ChartHit.js"
import { analytics } from "./DataCatalogUtils.js"
import { DataCatalogPagination } from "./DataCatalogPagination.js"
import { DataCatalogNoResults } from "./DataCatalogNoResults.js"
import { DataCatalogResultsSkeleton } from "./DataCatalogSkeletons.js"
import { DataCatalogSearchResult } from "./DataCatalogUtils.js"
import { TopicsRefinementListWrapper } from "./TopicsRefinementListWrapper.js"

export const DataCatalogResults = ({
    selectedCountries,
    results,
    setPage,
    addTopic,
    topics,
    isLoading,
}: {
    results?: DataCatalogSearchResult
    selectedCountries: Region[]
    setPage: (page: number) => void
    addTopic: (topic: string) => void
    topics: Set<string>
    isLoading: boolean
}) => {
    if (isLoading) return <DataCatalogResultsSkeleton />

    const hits = results?.hits
    if (!hits || !hits.length) return <DataCatalogNoResults />

    const { page, nbPages, nbHits } = results
    return (
        <>
            <TopicsRefinementListWrapper
                topics={topics}
                results={results}
                addTopic={addTopic}
            />
            <div className="span-cols-12 col-start-2 data-catalog-search-hits">
                {nbHits && (
                    <p className="data-catalog-search-list__results-count body-3-medium">
                        {commafyNumber(nbHits)}{" "}
                        {nbHits === 1 ? "indicator" : "indicators"}
                    </p>
                )}
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
                                searchQueryRegionsMatches={selectedCountries}
                            />
                        </li>
                    ))}
                </ul>
            </div>
            <DataCatalogPagination
                currentPage={page}
                setPage={setPage}
                nbPages={nbPages}
            />
        </>
    )
}
