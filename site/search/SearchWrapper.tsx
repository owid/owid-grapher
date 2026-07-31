import { TagGraphRoot } from "@ourworldindata/types"
import { QueryClientProvider } from "@tanstack/react-query"
import { Search } from "./Search.js"
import { getTypesenseConfig } from "./typesense/typesenseClient.js"
import { getSiteQueryClient } from "../queryClient.js"

export const SearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const queryClient = getSiteQueryClient()
    const typesenseConfig = getTypesenseConfig()

    return (
        <QueryClientProvider client={queryClient}>
            <Search
                topicTagGraph={topicTagGraph}
                typesenseConfig={typesenseConfig}
            />
        </QueryClientProvider>
    )
}
