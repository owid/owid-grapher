import { TagGraphRoot } from "@ourworldindata/types"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { Search } from "./Search.js"
import { getInitialSearchState } from "./searchState.js"
import algoliasearch from "algoliasearch"
import {
    QueryClient,
    QueryClientProvider,
    QueryCache,
} from "@tanstack/react-query"
import * as Sentry from "@sentry/react"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // In practice, stale queries do not result in another network
            // request, due to Algolia's caching. React Query's caching
            // (staleTime) should be considered a second line of defense.
            staleTime: 60 * 1000, // 1 minute
        },
    },
    // Manually sending errors to Sentry as React Query silently captures
    // errors. Some things to consider before setting up an error handling
    // strategy:
    // - throwOnError (v5) or useErrorBoundary (v4) defined at the query client
    //   level means that errors in queries are thrown and can be caught by an
    //   error boundary.
    // - however, a global error boundary around the search component means that
    //   a single fetch error (e.g. in SearchChartHitSmall) crashes the whole
    //   search results page. This calls for a more fine-grained approach.
    //
    // Logging is not a substitute for actual error handling, but rather a way
    // to gauge the prevalence of fetch errors in a React Query world, where
    // queries are now automatically retried (3 times by default) before
    // actually failing.
    queryCache: new QueryCache({
        onError: (error) => {
            Sentry.captureException(error)
        },
    }),
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
