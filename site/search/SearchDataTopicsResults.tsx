import { useQuery } from "@tanstack/react-query"
import { queryDataTopics, searchQueryKeys } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedTopic } from "./searchHooks.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchDataTopicsResponse } from "./searchTypes.js"
import { SearchDataTopic } from "./SearchDataTopic.js"

export const SearchDataTopicsResults = () => {
    const { state, searchClient, topicTagGraph } = useSearchContext()
    const selectedTopic = useSelectedTopic()

    const query = useQuery<SearchDataTopicsResponse[], Error>({
        queryKey: searchQueryKeys.dataTopics(state),
        queryFn: () =>
            queryDataTopics(searchClient, state, topicTagGraph, selectedTopic),
    })

    if (!query.data?.length) return null

    return (
        <SearchAsDraft
            name="Data Topics Results"
            className="span-cols-12 col-start-2"
        >
            <div className="search-data-topics-results">
                <div>
                    {query.data.map((result) => (
                        <SearchDataTopic key={result.title} result={result} />
                    ))}
                </div>
            </div>
        </SearchAsDraft>
    )
}
