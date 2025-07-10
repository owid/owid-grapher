import { DataInsightHit, SearchDataInsightResponse } from "./searchTypes.js"
import { queryDataInsights, searchQueryKeys } from "./queries.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { SearchShowMore } from "./SearchShowMore.js"
import { useInfiniteSearch } from "./searchHooks.js"
import { SearchDataInsightsResultsSkeleton } from "./SearchDataInsightsResultsSkeleton.js"

export function SearchDataInsightsResults() {
    const query = useInfiniteSearch<SearchDataInsightResponse, DataInsightHit>({
        queryKey: (state) => searchQueryKeys.dataInsights(state),
        queryFn: queryDataInsights,
    })

    const { hits, totalResults, isInitialLoading } = query

    if (isInitialLoading) return <SearchDataInsightsResultsSkeleton />
    if (totalResults === 0) return null

    return (
        <section className="col-start-2 span-cols-12">
            <SearchResultHeader count={totalResults}>
                Data Insights
            </SearchResultHeader>
            <div className="search-data-insights-results__hits">
                {hits.map((hit: DataInsightHit) => (
                    <SearchDataInsightHit key={hit.objectID} hit={hit} />
                ))}
            </div>
            {query.hasNextPage && (
                <SearchShowMore
                    isLoading={query.isFetchingNextPage}
                    onClick={query.fetchNextPage}
                />
            )}
        </section>
    )
}
