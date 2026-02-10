import { useRef } from "react"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"

import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import {
    DataInsightHit,
    SearchDataInsightResponse,
} from "@ourworldindata/types"
import {
    queryDataInsights,
    queryDataInsightsViaApi,
    searchQueryKeys,
} from "./queries.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { useInfiniteSearch, useInfiniteSearchViaApi } from "./searchHooks.js"
import { SearchDataInsightsResultsSkeleton } from "./SearchDataInsightsResultsSkeleton.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"
import { useSearchContext } from "./SearchContext.js"

export function SearchDataInsightsResults() {
    const { analytics, useAISearch } = useSearchContext()
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)

    const aiQuery = useInfiniteSearchViaApi<
        SearchDataInsightResponse,
        DataInsightHit
    >({
        queryKey: (state) => searchQueryKeys.dataInsights(state),
        queryFn: queryDataInsightsViaApi,
        enabled: useAISearch,
    })

    const algoliaQuery = useInfiniteSearch<
        SearchDataInsightResponse,
        DataInsightHit
    >({
        queryKey: (state) => searchQueryKeys.dataInsights(state),
        queryFn: queryDataInsights,
        enabled: !useAISearch,
    })

    const query = useAISearch ? aiQuery : algoliaQuery

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

    const { hits, totalResults, isLoading } = query

    if (!isLoading && totalResults === 0) return null

    return (
        <>
            <section>
                {isLoading ? (
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
                            {hits.map((hit: DataInsightHit, index) => (
                                <SearchDataInsightHit
                                    key={hit.objectID}
                                    hit={hit}
                                    onClick={() => {
                                        analytics.logSiteSearchResultClick(
                                            hit,
                                            {
                                                position: index + 1,
                                                source: "search",
                                            }
                                        )
                                    }}
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
                hasButton={!isLoading && query.hasNextPage && !isSmallScreen}
                isLoading={query.isFetchingNextPage}
                onClick={query.fetchNextPage}
            />
        </>
    )
}
