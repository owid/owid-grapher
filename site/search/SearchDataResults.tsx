import { queryCharts, searchQueryKeys } from "./queries.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { useSelectedCountries, useInfiniteSearch } from "./searchHooks.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import {
    SearchChartsResponse,
    SearchChartHit,
    SearchChartHitComponentVariant,
} from "./searchTypes.js"
import { SearchDataResultsSkeleton } from "./SearchDataResultsSkeleton.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"

const analytics = new SiteAnalytics()

export const SearchDataResults = ({
    isFirstChartLarge,
}: {
    isFirstChartLarge: boolean
}) => {
    const selectedCountries = useSelectedCountries()

    const query = useInfiniteSearch<SearchChartsResponse, SearchChartHit>({
        queryKey: (state) => searchQueryKeys.charts(state),
        queryFn: queryCharts,
    })

    const { hits, totalResults, isInitialLoading } = query

    if (!isInitialLoading && totalResults === 0) return null

    return (
        <>
            <section>
                {isInitialLoading ? (
                    <SearchDataResultsSkeleton />
                ) : (
                    <>
                        <SearchResultHeader count={totalResults}>
                            Data
                        </SearchResultHeader>
                        <ul className="search-data-results__list">
                            {hits.map((hit, hitIndex) => {
                                let variant: SearchChartHitComponentVariant =
                                    hitIndex < 5 ? "medium" : "small"
                                if (hitIndex === 0 && isFirstChartLarge)
                                    variant = "large"

                                const onClick = () => {
                                    analytics.logDataCatalogResultClick(
                                        hit,
                                        hitIndex + 1,
                                        "search"
                                    )
                                }

                                return (
                                    <li
                                        className="search-data-results__hit"
                                        key={hit.objectID}
                                    >
                                        <SearchChartHitComponent
                                            hit={hit}
                                            variant={variant}
                                            searchQueryRegionsMatches={
                                                selectedCountries
                                            }
                                            onClick={onClick}
                                        />
                                    </li>
                                )
                            })}
                        </ul>
                    </>
                )}
            </section>
            <SearchHorizontalDivider
                hasButton={!isInitialLoading && query.hasNextPage}
                isLoading={query.isFetchingNextPage}
                onClick={query.fetchNextPage}
            />
        </>
    )
}
