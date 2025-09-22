import { queryCharts, searchQueryKeys } from "./queries.js"
import { useSelectedRegionNames, useInfiniteSearch } from "./searchHooks.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import {
    SearchChartsResponse,
    SearchChartHit,
    SearchChartHitComponentVariant,
} from "./searchTypes.js"
import { SearchDataResultsSkeleton } from "./SearchDataResultsSkeleton.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"
import { useSearchContext } from "./SearchContext.js"

export const SearchDataResults = ({
    isFirstChartLarge,
}: {
    isFirstChartLarge: boolean
}) => {
    const { analytics } = useSearchContext()
    const selectedRegionNames = useSelectedRegionNames(true)

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
                                const variant: SearchChartHitComponentVariant =
                                    isFirstChartLarge
                                        ? hitIndex === 0
                                            ? "large"
                                            : hitIndex <= 3
                                              ? "medium"
                                              : "small"
                                        : hitIndex < 4
                                          ? "medium"
                                          : "small"

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
                                            selectedRegionNames={
                                                selectedRegionNames
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
