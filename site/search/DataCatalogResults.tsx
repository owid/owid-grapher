import { useQuery } from "@tanstack/react-query"
import { SearchChartHitMedium } from "./SearchChartHitMedium.js"
import { SearchChartHitLarge } from "./SearchChartHitLarge.js"
import { DataCatalogPagination } from "./DataCatalogPagination.js"
import { SearchNoResults } from "./SearchNoResults.js"
import { DataCatalogResultsSkeleton } from "./DataCatalogResultsSkeleton.js"
import { DataCatalogSearchResult } from "./searchTypes.js"
import { queryDataCatalogSearch, searchQueryKeys } from "./queries.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedCountries } from "./searchHooks.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchResultHeader } from "./SearchResultHeader.js"

const analytics = new SiteAnalytics()

export const DataCatalogResults = ({
    enableLargeFirstResult = true,
}: {
    enableLargeFirstResult?: boolean
}) => {
    const {
        state,
        actions: { setPage },
        searchClient,
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
        <SearchAsDraft name="Data Results" className="span-cols-12 col-start-2">
            <div className="data-catalog-search-hits">
                <SearchResultHeader title="Data" count={nbHits} />
                <ul className="data-catalog-search-list">
                    {hits.map((hit, i) => {
                        const isFirstResult = i === 0
                        const shouldChartHitLarge =
                            enableLargeFirstResult &&
                            isFirstResult &&
                            page === 0

                        return (
                            <li
                                className="data-catalog-search-hit"
                                key={hit.objectID}
                            >
                                {shouldChartHitLarge ? (
                                    <SearchChartHitLarge
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
                                ) : (
                                    <SearchChartHitMedium
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
                                )}
                            </li>
                        )
                    })}
                </ul>
            </div>
            <DataCatalogPagination
                currentPage={page}
                setPage={setPage}
                nbPages={nbPages}
            />
        </SearchAsDraft>
    )
}
