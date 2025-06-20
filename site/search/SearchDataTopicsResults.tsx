import { useQuery } from "@tanstack/react-query"
import { queryDataTopics, searchQueryKeys } from "./queries.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedTopic } from "./searchHooks.js"
import { SearchResultHeader } from "./SearchResultHeader.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchDataTopicsResponse } from "./searchTypes.js"
import { SearchDataTopic } from "./SearchDataTopic.js"

export const SearchDataTopicsResults = () => {
    const { state, searchClient, topicTagGraph } = useSearchContext()
    const selectedTopic = useSelectedTopic()

    const query = useQuery<SearchDataTopicsResponse[], Error>({
        queryKey: searchQueryKeys.topics(state),
        queryFn: () =>
            queryDataTopics(searchClient, state, topicTagGraph, selectedTopic),
    })

    const resultsSortedByHitCount = query.data?.sort(
        (a, b) => b.nbHits - a.nbHits
    )

    const totalCount =
        query.data?.reduce((acc, result) => acc + result.nbHits, 0) || 0

    if (totalCount === 0) return null

    return (
        <SearchAsDraft
            name="Data Topics Results"
            className="span-cols-12 col-start-2"
        >
            <div className=" data-catalog-ribbons">
                <div>
                    <SearchResultHeader title="Charts" count={totalCount} />
                    {resultsSortedByHitCount?.map((result) => (
                        <SearchDataTopic key={result.title} result={result} />
                    ))}
                </div>
            </div>
        </SearchAsDraft>
    )
}
