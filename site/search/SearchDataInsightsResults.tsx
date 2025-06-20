import { SearchAsDraft } from "./SearchAsDraft.js"
import { DataInsightHit, DataInsightSearchResponse } from "./searchTypes.js"
import { useQuery } from "@tanstack/react-query"
import { queryDataInsights, searchQueryKeys } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"
import { SearchResultHeader } from "./SearchResultHeader.js"

export function SearchDataInsightsResults() {
    const { state, searchClient } = useSearchContext()

    const query = useQuery<DataInsightSearchResponse, Error>({
        queryKey: [searchQueryKeys.dataInsights(state)],
        queryFn: () => queryDataInsights(searchClient, state),
    })

    const hits = query.data?.hits
    if (!query.data || !hits || !hits.length) return null

    const { nbHits } = query.data

    return (
        <SearchAsDraft
            name="Data Insights"
            className="grid span-cols-12 col-start-2"
        >
            <section className="search-data-insights-results span-cols-12">
                <SearchResultHeader title="Data Insights" count={nbHits} />
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
        </SearchAsDraft>
    )
}
