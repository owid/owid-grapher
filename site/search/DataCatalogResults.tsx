import { commafyNumber } from "@ourworldindata/utils"
import { SearchClient } from "algoliasearch"
import { useQuery } from "@tanstack/react-query"
import { ChartHit } from "./ChartHit.js"
import { DataCatalogPagination } from "./DataCatalogPagination.js"
import { SearchNoResults } from "./SearchNoResults.js"
import { DataCatalogResultsSkeleton } from "./DataCatalogResultsSkeleton.js"
import { DataCatalogSearchResult } from "./searchTypes.js"
import { queryDataCatalogSearch, searchQueryKeys } from "./queries.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedCountries } from "./searchHooks.js"

const analytics = new SiteAnalytics()

export const DataCatalogResults = ({
    searchClient,
}: {
    searchClient: SearchClient
}) => {
    const {
        state,
        actions: { setPage },
    } = useSearchContext()
    const selectedCountries = useSelectedCountries()

    const query = useQuery<DataCatalogSearchResult, Error>({
        queryKey: searchQueryKeys.dataSearches(state),
        queryFn: () => queryDataCatalogSearch(searchClient, state),
    })

    if (query.isLoading) return <DataCatalogResultsSkeleton />

    const hits = query.data?.hits
    if (!query.data || !hits || !hits.length) return <SearchNoResults />

    const { page, nbPages, nbHits } = query.data
    return (
        <>
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
