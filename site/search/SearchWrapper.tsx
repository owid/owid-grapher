import { TagGraphRoot } from "@ourworldindata/types"
import { QueryClientProvider } from "@tanstack/react-query"
import { Search } from "./Search.js"
import { getLiteSearchClient } from "./searchClients.js"
import { getSiteQueryClient } from "../queryClient.js"

export const SearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const queryClient = getSiteQueryClient()
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
