import { TagGraphRoot } from "@ourworldindata/types"
import { QueryClientProvider } from "@tanstack/react-query"
import { Search } from "./Search.js"
import { getLiteSearchClient, getSearchQueryClient } from "./searchClients.js"

export const SearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const queryClient = getSearchQueryClient()
    const liteSearchClient = getLiteSearchClient()

    return (
        <QueryClientProvider client={queryClient}>
            <Search
                topicTagGraph={topicTagGraph}
                liteSearchClient={liteSearchClient}
            />
        </QueryClientProvider>
    )
}
