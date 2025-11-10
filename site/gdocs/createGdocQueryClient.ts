import {
    QueryClient,
    QueryClientConfig,
    QueryCache,
} from "@tanstack/react-query"
import * as Sentry from "@sentry/react"

const gdocQueryClientConfig: QueryClientConfig = {
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minute
        },
    },
    queryCache: new QueryCache({
        onError: (error) => {
            Sentry.captureException(error)
        },
    }),
}

export const createGdocQueryClient = (): QueryClient =>
    new QueryClient(gdocQueryClientConfig)
