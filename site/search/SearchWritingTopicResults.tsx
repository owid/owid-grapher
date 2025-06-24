import { useQuery } from "@tanstack/react-query"
import { queryWritingTopics, searchQueryKeys } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedTopic } from "./searchHooks.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchWritingTopicsResponse } from "./searchTypes.js"
import { SearchWritingTopic } from "./SearchWritingTopic.js"

export const SearchWritingTopicResults = () => {
    const { state, searchClient, topicTagGraph } = useSearchContext()
    const selectedTopic = useSelectedTopic()

    const query = useQuery<SearchWritingTopicsResponse[], Error>({
        queryKey: searchQueryKeys.writingTopics(state),
        queryFn: () =>
            queryWritingTopics(searchClient, topicTagGraph, selectedTopic),
    })

    if (!query.data?.length) return null

    return (
        <SearchAsDraft
            name="Writing Topics Results"
            className="span-cols-12 col-start-2"
        >
            <div className="search-writing-topics-results">
                {query.data.map((result) => (
                    <SearchWritingTopic key={result.title} result={result} />
                ))}
            </div>
        </SearchAsDraft>
    )
}
