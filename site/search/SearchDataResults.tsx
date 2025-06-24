import { SearchChartHitMedium } from "./SearchChartHitMedium.js"
import { SearchChartHitLarge } from "./SearchChartHitLarge.js"
import { SearchShowMore } from "./SearchShowMore.js"
import { queryCharts, searchQueryKeys } from "./queries.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { useSelectedCountries, useInfiniteSearch } from "./searchHooks.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { SearchChartsResponse, SearchChartHit } from "./searchTypes.js"

const analytics = new SiteAnalytics()

export const SearchDataResults = ({
    isFirstChartLarge = true,
}: {
    isFirstChartLarge?: boolean
}) => {
    const selectedCountries = useSelectedCountries()

    const query = useInfiniteSearch<SearchChartsResponse, SearchChartHit>({
        queryKey: (state) => searchQueryKeys.charts(state),
        queryFn: queryCharts,
    })

    const { hits, totalResults } = query

    if (totalResults === 0) return null

    return (
        <SearchAsDraft name="Data Results" className="span-cols-12 col-start-2">
            <div className="search-data-results__hits">
                <SearchResultHeader title="Data" count={totalResults} />
                <ul className="search-data-results__list">
                    {hits.map((hit, i) => {
                        const isFirstResult = i === 0
                        const shouldChartHitLarge =
                            isFirstChartLarge && isFirstResult
                        const showThumbnails = i < 5

                        return (
                            <li
                                className="search-data-results__hit"
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
