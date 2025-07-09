import { useQuery } from "@tanstack/react-query"
import { queryWritingTopics, searchQueryKeys } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedTopic } from "./searchHooks.js"
import { SearchWritingTopicsResponse } from "./searchTypes.js"
import { SearchWritingTopic } from "./SearchWritingTopic.js"
import { SearchWritingTopicsResultsSkeleton } from "./SearchWritingTopicsResultsSkeleton.js"

export const SearchWritingTopicsResults = () => {
    const { state, searchClient, topicTagGraph } = useSearchContext()
    const selectedTopic = useSelectedTopic()

    const query = useQuery<SearchWritingTopicsResponse[], Error>({
        queryKey: searchQueryKeys.writingTopics(state),
        queryFn: () =>
            queryWritingTopics(searchClient, topicTagGraph, selectedTopic),
    })

    if (query.isLoading) return <SearchWritingTopicsResultsSkeleton />
    if (!query.data?.length) return null

    return (
        <div className="search-writing-topics-results span-cols-12 col-start-2">
            {query.data.map((result) => (
                <SearchWritingTopic key={result.title} result={result} />
            ))}
        </div>
    )
}
