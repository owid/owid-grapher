import React from "react"
import { TagGraphRoot } from "@ourworldindata/types"
import { QueryClientProvider } from "@tanstack/react-query"
import {
    getLiteSearchClient,
    getSearchQueryClient,
} from "../search/searchClients.js"
import { LiteClient } from "algoliasearch/lite"

export const LatestSearchWrapper = ({
    topicTagGraph,
    children,
}: {
    topicTagGraph: TagGraphRoot
    children: (props: {
        topicTagGraph: TagGraphRoot
        liteSearchClient: LiteClient
    }) => React.ReactNode
}) => {
    const queryClient = getSearchQueryClient()
    const liteSearchClient = getLiteSearchClient()

    return (
        <QueryClientProvider client={queryClient}>
            {children({ topicTagGraph, liteSearchClient })}
        </QueryClientProvider>
    )
}
