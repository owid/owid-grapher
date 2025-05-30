import { Region, commafyNumber } from "@ourworldindata/utils"
import { ChartHit } from "./ChartHit.js"
import { DataCatalogPagination } from "./DataCatalogPagination.js"
import { SearchNoResults } from "./SearchNoResults.js"
import { DataCatalogResultsSkeleton } from "./DataCatalogResultsSkeleton.js"
import { DataCatalogSearchResult } from "./searchTypes.js"
import { TopicsRefinementList } from "./TopicsRefinementList.js"
import { SiteAnalytics } from "../SiteAnalytics.js"

const analytics = new SiteAnalytics()

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
    if (!hits || !hits.length) return <SearchNoResults />

    const { facets, page, nbPages, nbHits } = results
    return (
        <>
            <TopicsRefinementList
                topics={topics}
                facets={facets?.tags}
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
