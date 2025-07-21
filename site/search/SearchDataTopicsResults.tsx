import { useQuery } from "@tanstack/react-query"
import { queryDataTopics, searchQueryKeys } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedTopic } from "./searchHooks.js"
import { SearchDataTopicsResponse } from "./searchTypes.js"
import { SearchDataTopic } from "./SearchDataTopic.js"
import { SearchDataTopicsResultsSkeleton } from "./SearchDataTopicsResultsSkeleton.js"

export const SearchDataTopicsResults = () => {
    const { state, searchClient, topicTagGraph } = useSearchContext()
    const selectedTopic = useSelectedTopic()

    const query = useQuery<SearchDataTopicsResponse[], Error>({
        queryKey: searchQueryKeys.dataTopics(state),
        queryFn: () =>
            queryDataTopics(searchClient, state, topicTagGraph, selectedTopic),
    })

    if (query.isInitialLoading) return <SearchDataTopicsResultsSkeleton />
    if (!query.data?.length) return null

    return (
        <div className="search-data-topics-results span-cols-12 col-start-2">
            <div>
                {query.data.map((result) => (
                    <SearchDataTopic key={result.title} result={result} />
                ))}
            </div>
        </div>
    )
}
