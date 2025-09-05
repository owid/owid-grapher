import { TagGraphRoot } from "@ourworldindata/types"
import { QueryClientProvider } from "@tanstack/react-query"
import { TYPESENSE_SEARCH_KEY } from "../../settings/clientSettings.js"
import { Search } from "./Search.js"
import { getLiteSearchClient, getSearchQueryClient } from "./searchClients.js"
import { initTypesenseClient } from "./typesense/typesenseClient.js"

export const SearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const queryClient = getSearchQueryClient()
    const liteSearchClient = getLiteSearchClient()
    initTypesenseClient(TYPESENSE_SEARCH_KEY)

    return (
        <QueryClientProvider client={queryClient}>
            <Search
                topicTagGraph={topicTagGraph}
                liteSearchClient={liteSearchClient}
            />
        </QueryClientProvider>
    )
}
