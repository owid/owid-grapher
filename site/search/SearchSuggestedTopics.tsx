import { useQuery } from "@tanstack/react-query"
import { FilterType } from "@ourworldindata/types"
import { useSearchContext } from "./SearchContext.js"
import { getFilterIcon, getFilterNamesOfType } from "./searchUtils.js"
import { SearchFilterPill } from "./SearchFilterPill.js"

interface TopicHit {
    name: string
    slug: string
    score: number
}

interface TopicsApiResponse {
    hits: TopicHit[]
}

async function fetchSuggestedTopics(query: string): Promise<TopicsApiResponse> {
    const params = new URLSearchParams({ q: query, limit: "3" })
    const response = await fetch(`/api/ai-search/topics?${params}`)
    return response.json()
}

export const SearchSuggestedTopics = () => {
    const {
        state: { filters, query },
        actions: { setTopicAndClearQuery },
    } = useSearchContext()

    const hasTopicFilter =
        getFilterNamesOfType(filters, FilterType.TOPIC).size > 0

    const enabled = query.length > 0 && !hasTopicFilter

    const { data } = useQuery({
        queryKey: ["suggestedTopics", query],
        queryFn: () => fetchSuggestedTopics(query),
        enabled,
        staleTime: 60_000,
    })

    const hits = data?.hits
    if (!hits?.length) return null

    return (
        <div className="search-suggested-topics">
            <span className="search-suggested-topics__label">Browse topic</span>
            {hits.map((hit) => (
                <button
                    type="button"
                    onClick={() => setTopicAndClearQuery(hit.name)}
                    key={hit.slug}
                    className="search-suggested-topic-button"
                >
                    <SearchFilterPill
                        icon={getFilterIcon({
                            type: FilterType.TOPIC,
                            name: hit.name,
                        })}
                        name={hit.name}
                        interactive={true}
                    />
                </button>
            ))}
        </div>
    )
}
