import { useRef } from "react"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"

import { DataInsightHit } from "@ourworldindata/types"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { queryDataInsights, searchQueryKeys } from "./queries.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { useInfiniteSearch } from "./searchHooks.js"
import { SearchDataInsightsResultsSkeleton } from "./SearchDataInsightsResultsSkeleton.js"
import { SearchHorizontalDivider } from "./SearchHorizontalDivider.js"
import { useSearchContext } from "./SearchContext.js"
import { SearchClosestMatchesNotice } from "./SearchClosestMatchesNotice.js"

export function SearchDataInsightsResults() {
    const { analytics } = useSearchContext()
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const query = useInfiniteSearch({
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

    const { hits, totalResults, isLoading, isClosestMatches } = query

    function handleClick(hit: DataInsightHit, position: number) {
        analytics.logSearchResultClick(hit, {
            position,
            source: "search",
        })
    }

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
                        {isClosestMatches && <SearchClosestMatchesNotice />}
                        <div
                            ref={container}
                            className="search-data-insights-results__hits"
                        >
                            {hits.map((hit, index) => (
                                <SearchDataInsightHit
                                    key={hit.objectID}
                                    hit={hit}
                                    onClick={() => handleClick(hit, index + 1)}
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
