import { TagGraphRoot } from "@ourworldindata/types"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { Search } from "./Search.js"
import { getInitialSearchState } from "./searchState.js"
import algoliasearch from "algoliasearch"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minute
        },
    },
})

export const SearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    const initialState = getInitialSearchState()

    return (
        <QueryClientProvider client={queryClient}>
            <Search
                initialState={initialState}
                topicTagGraph={topicTagGraph}
                searchClient={searchClient}
            />
        </QueryClientProvider>
    )
}
