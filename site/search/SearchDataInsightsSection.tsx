import { AsDraft } from "../AsDraft/AsDraft.js"
import { DataInsightHit, DataInsightSearchResponse } from "./searchTypes.js"
import { useQuery } from "@tanstack/react-query"
import { queryDataInsights, searchQueryKeys } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { SearchDataInsightHit } from "./SearchDataInsightHit.js"

export function SearchDataInsights() {
    const { state, searchClient } = useSearchContext()
    const query = useQuery<DataInsightSearchResponse, Error>({
        queryKey: [searchQueryKeys.dataInsights(state)],
        queryFn: () => queryDataInsights(searchClient, state),
    })

    const hits = query.data?.hits
    if (!query.data || !hits || !hits.length) return null

    const { nbHits } = query.data

    return (
        <AsDraft name="Data Insights" className="grid span-cols-12 col-start-2">
            <section className="search-data-insights span-cols-12">
                <header className="search-data-insights__header">
                    <h3 className="search-data-insights__title">
                        Data Insights
                    </h3>
                    <span className="search-data-insights__count">
                        ({nbHits} results)
                    </span>
                </header>
                <div className="search-data-insights__hits grid">
                    {hits.map((hit: DataInsightHit) => (
                        <SearchDataInsightHit
                            className="span-cols-3"
                            key={hit.objectID}
                            hit={hit}
                        />
                    ))}
                </div>
            </section>
        </AsDraft>
    )
}
