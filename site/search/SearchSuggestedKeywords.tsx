import { useQuery } from "@tanstack/react-query"
import { useSearchContext } from "./SearchContext.js"
import { SearchFilterPill } from "./SearchFilterPill.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSearch } from "@fortawesome/free-solid-svg-icons"

interface RewriteResponse {
    keywords: string[]
}

async function fetchSuggestedKeywords(
    query: string
): Promise<RewriteResponse> {
    const params = new URLSearchParams({ q: query })
    const response = await fetch(`/api/ai-search/rewrite?${params}`)
    return response.json()
}

export const SearchSuggestedKeywords = () => {
    const {
        state: { query },
        actions: { setQuery },
    } = useSearchContext()

    const enabled = query.length > 0

    const { data } = useQuery({
        queryKey: ["suggestedKeywords", query],
        queryFn: () => fetchSuggestedKeywords(query),
        enabled,
        staleTime: 60_000,
    })

    const keywords = data?.keywords
    if (!keywords?.length) return null

    return (
        <div className="search-suggested-keywords">
            <span className="search-suggested-keywords__label">Try also</span>
            {keywords.map((keyword) => (
                <button
                    type="button"
                    onClick={() => setQuery(keyword)}
                    key={keyword}
                    className="search-suggested-keyword-button"
                >
                    <SearchFilterPill
                        icon={
                            <span className="icon">
                                <FontAwesomeIcon icon={faSearch} />
                            </span>
                        }
                        name={keyword}
                        interactive={true}
                    />
                </button>
            ))}
        </div>
    )
}
