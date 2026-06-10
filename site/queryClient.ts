import { QueryClient, QueryCache } from "@tanstack/react-query"
import * as Sentry from "@sentry/react"

let queryClient: QueryClient | null = null

// Shared site-wide React Query client. Individual queries should override
// staleTime as appropriate (e.g. Infinity for static config).
export const getSiteQueryClient = (): QueryClient => {
    if (!queryClient) {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    staleTime: 60 * 60 * 1000, // 1 hour
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
    }
    return queryClient
}
