import { useRef } from "react"
import { useIntersectionObserver } from "usehooks-ts"

import { DataInsightHit, SearchDataInsightResponse } from "./searchTypes.js"
import { queryDataInsights, searchQueryKeys } from "./queries.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { SearchShowMore } from "./SearchShowMore.js"
import { useInfiniteSearch } from "./searchHooks.js"
import { SearchDataInsightsResultsSkeleton } from "./SearchDataInsightsResultsSkeleton.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"

export function SearchDataInsightsResults() {
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

    if (isInitialLoading) return <SearchDataInsightsResultsSkeleton />
    if (totalResults === 0) return null

    return (
        <>
            <section>
                <SearchResultHeader count={totalResults}>
                    Data Insights
                </SearchResultHeader>
                <div
                    ref={container}
                    className="search-data-insights-results__hits"
                >
                    {hits.map((hit: DataInsightHit) => (
                        <SearchDataInsightHit key={hit.objectID} hit={hit} />
                    ))}
                    {query.hasNextPage && (
                        <div
                            ref={triggerRef}
                            className="search-data-insights-results__trigger"
                        />
                    )}
                </div>
                {query.hasNextPage && (
                    <SearchShowMore
                        className="search-data-insights-results__show-more"
                        isLoading={query.isFetchingNextPage}
                        onClick={query.fetchNextPage}
                    />
                )}
            </section>
            <SearchHorizontalDivider />
        </>
    )
}
