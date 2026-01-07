import { queryCharts, searchQueryKeys } from "./queries.js"
import { useSelectedRegionNames, useInfiniteSearch } from "./searchHooks.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import {
    SearchChartsResponse,
    SearchChartHit,
    SearchChartHitComponentVariant,
} from "@ourworldindata/types"
import { SearchDataResultsSkeleton } from "./SearchDataResultsSkeleton.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"

export const SearchDataResults = ({
    isFirstChartLarge,
}: {
    isFirstChartLarge: boolean
}) => {
    const selectedRegionNames = useSelectedRegionNames()

    const query = useInfiniteSearch<SearchChartsResponse, SearchChartHit>({
        queryKey: (state) => searchQueryKeys.charts(state),
        queryFn: queryCharts,
    })

    const { hits, totalResults, isLoading } = query

    if (!isLoading && totalResults === 0) return null

    return (
        <>
            <section>
                {isLoading ? (
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
                                        />
                                    </li>
                                )
                            })}
                        </ul>
                    </>
                )}
            </section>
            <SearchHorizontalDivider
                hasButton={!isLoading && query.hasNextPage}
                isLoading={query.isFetchingNextPage}
                onClick={query.fetchNextPage}
            />
        </>
    )
}
