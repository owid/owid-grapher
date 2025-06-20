import { useInfiniteQuery } from "@tanstack/react-query"
import { SearchChartHitMedium } from "./SearchChartHitMedium.js"
import { SearchChartHitLarge } from "./SearchChartHitLarge.js"
import { SearchShowMore } from "./SearchShowMore.js"
import { SearchChartsResponse } from "./searchTypes.js"
import { queryCharts, searchQueryKeys } from "./queries.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedCountries } from "./searchHooks.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchResultHeader } from "./SearchResultHeader.js"

const analytics = new SiteAnalytics()

export const SearchDataResults = ({
    isFirstChartLarge = true,
}: {
    isFirstChartLarge?: boolean
}) => {
    const { state, searchClient } = useSearchContext()
    const selectedCountries = useSelectedCountries()

    // Create state without page for infinite query key so that a single cache
    // entry is shared across all pages
    const { page: _page, ...stateWithoutPage } = state

    const query = useInfiniteQuery<SearchChartsResponse, Error>({
        queryKey: searchQueryKeys.charts(stateWithoutPage),
        queryFn: ({ pageParam = 0 }) =>
            queryCharts(searchClient, { ...state, page: pageParam }),
        getNextPageParam: (lastPage) => {
            const { page, nbPages } = lastPage
            return page < nbPages - 1 ? page + 1 : undefined
        },
    })

    const hits = query.data?.pages.flatMap((page) => page.hits) || []
    const totalResults = query.data?.pages[0]?.nbHits || 0

    if (totalResults === 0) return null

    return (
        <SearchAsDraft name="Data Results" className="span-cols-12 col-start-2">
            <div className="data-catalog-search-hits">
                <SearchResultHeader title="Data" count={totalResults} />
                <ul className="data-catalog-search-list">
                    {hits.map((hit, i) => {
                        const isFirstResult = i === 0
                        const shouldChartHitLarge =
                            isFirstChartLarge && isFirstResult
                        const showThumbnails = i < 5

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
                                        showThumbnails={showThumbnails}
                                    />
                                )}
                            </li>
                        )
                    })}
                </ul>
            </div>
            <SearchShowMore
                hasNextPage={query.hasNextPage ?? false}
                isFetchingNextPage={query.isFetchingNextPage}
                fetchNextPage={query.fetchNextPage}
            />
        </SearchAsDraft>
    )
}
