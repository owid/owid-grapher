import { SearchAsDraft } from "./SearchAsDraft.js"
import { DataInsightHit, SearchDataInsightResponse } from "./searchTypes.js"
import { queryDataInsights, searchQueryKeys } from "./queries.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { SearchShowMore } from "./SearchShowMore.js"
import { useInfiniteSearch } from "./searchHooks.js"

export function SearchDataInsightsResults() {
    const query = useInfiniteSearch<SearchDataInsightResponse, DataInsightHit>({
        queryKey: (state) => searchQueryKeys.dataInsights(state),
        queryFn: queryDataInsights,
    })

    const { hits, totalResults } = query

    if (totalResults === 0) return null

    return (
        <SearchAsDraft
            name="Data Insights"
            className="grid span-cols-12 col-start-2"
        >
            <section className="search-data-insights-results span-cols-12">
                <SearchResultHeader
                    title="Data Insights"
                    count={totalResults}
                />
                <div className="search-data-insights-results__hits grid">
                    {hits.map((hit: DataInsightHit) => (
                        <SearchDataInsightHit
                            className="span-cols-3"
                            key={hit.objectID}
                            hit={hit}
                        />
                    ))}
                </div>
            </section>
            <SearchShowMore
                hasNextPage={query.hasNextPage ?? false}
                isFetchingNextPage={query.isFetchingNextPage}
                fetchNextPage={query.fetchNextPage}
                className="span-cols-12"
            />
        </SearchAsDraft>
    )
}
