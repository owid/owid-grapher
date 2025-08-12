import { useRef } from "react"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"

import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { DataInsightHit, SearchDataInsightResponse } from "./searchTypes.js"
import { queryDataInsights, searchQueryKeys } from "./queries.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { useInfiniteSearch } from "./searchHooks.js"
import { SearchDataInsightsResultsSkeleton } from "./SearchDataInsightsResultsSkeleton.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"

export function SearchDataInsightsResults() {
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const query = useInfiniteSearch<SearchDataInsightResponse, DataInsightHit>({
        queryKey: (state) => searchQueryKeys.dataInsights(state),
        queryFn: queryDataInsights,
    })

    const container = useRef<HTMLDivElement>(null)
    const { ref: triggerRef } = useIntersectionObserver({
        root: container.current,
        // Observe only the x-axis.
        // https://stackoverflow.com/a/68714239/9846837
        rootMargin: "100% 600px 100% 0%",
        onChange: (isIntersecting) => {
            if (isIntersecting && !query.isFetchingNextPage) {
                void query.fetchNextPage()
            }
        },
    })

    const { hits, totalResults, isInitialLoading } = query

    if (!isInitialLoading && totalResults === 0) return null

    return (
        <>
            <section>
                {isInitialLoading ? (
                    <SearchDataInsightsResultsSkeleton />
                ) : (
                    <>
                        <SearchResultHeader count={totalResults}>
                            Data Insights
                        </SearchResultHeader>
                        <div
                            ref={container}
                            className="search-data-insights-results__hits"
                        >
                            {hits.map((hit: DataInsightHit) => (
                                <SearchDataInsightHit
                                    key={hit.objectID}
                                    hit={hit}
                                />
                            ))}
                            {query.hasNextPage && (
                                <div
                                    ref={triggerRef}
                                    className="search-data-insights-results__trigger"
                                />
                            )}
                        </div>
                    </>
                )}
            </section>
            <SearchHorizontalDivider
                hasButton={
                    !isInitialLoading && query.hasNextPage && !isSmallScreen
                }
                isLoading={query.isFetchingNextPage}
                onClick={query.fetchNextPage}
            />
        </>
    )
}
