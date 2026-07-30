import { queryCharts, searchQueryKeys } from "./queries.js"
import { useSelectedRegionNames, useInfiniteSearch } from "./searchHooks.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { SearchChartHit } from "@ourworldindata/types"
import { SearchDataResultsSkeleton } from "./SearchDataResultsSkeleton.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"
import { SearchClosestMatchesNotice } from "./SearchClosestMatchesNotice.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"
import { useSearchContext } from "./SearchContext.js"

export const SearchDataResults = ({
    isFirstChartLarge,
}: {
    isFirstChartLarge: boolean
}) => {
    const { analytics } = useSearchContext()
    const selectedRegionNames = useSelectedRegionNames()

    const query = useInfiniteSearch({
        queryKey: (state) => searchQueryKeys.charts(state),
        queryFn: queryCharts,
    })

    const { hits, totalResults, isLoading, isClosestMatches } = query

    function handleClick(
        hit: SearchChartHit,
        position: number,
        vizType: string | null
    ) {
        analytics.logSearchResultClick(hit, {
            position,
            source: "search",
            vizType,
        })
    }

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
                        {isClosestMatches && <SearchClosestMatchesNotice />}
                        <ul className="search-data-results__list">
                            {hits.map((hit, hitIndex) => {
                                const variant = isFirstChartLarge
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
                                            onClick={(vizType) =>
                                                handleClick(
                                                    hit,
                                                    hitIndex + 1,
                                                    vizType
                                                )
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
