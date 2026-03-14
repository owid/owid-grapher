import { TagGraphRoot } from "@ourworldindata/types"
import { QueryClientProvider } from "@tanstack/react-query"
import { Search } from "./Search.js"
import { getSearchQueryClient } from "./searchClients.js"
import { getTypesenseClient } from "./typesense/typesenseClient.js"

export const SearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const queryClient = getSearchQueryClient()
    const typesenseClient = getTypesenseClient()

    return (
        <QueryClientProvider client={queryClient}>
            <Search
                topicTagGraph={topicTagGraph}
                typesenseClient={typesenseClient}
            />
        </QueryClientProvider>
    )
}
