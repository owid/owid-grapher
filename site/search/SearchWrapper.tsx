import { TagGraphRoot } from "@ourworldindata/types"
import { QueryClientProvider } from "@tanstack/react-query"
import { Search } from "./Search.js"
import { getInitialSearchState } from "./searchState.js"
import { getLiteSearchClient, getSearchQueryClient } from "./searchClients.js"

export const SearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const queryClient = getSearchQueryClient()
    const liteSearchClient = getLiteSearchClient()
    const initialState = getInitialSearchState()

    return (
        <QueryClientProvider client={queryClient}>
            <Search
                initialState={initialState}
                topicTagGraph={topicTagGraph}
                liteSearchClient={liteSearchClient}
            />
        </QueryClientProvider>
    )
}
