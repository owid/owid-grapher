import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { LiteClient } from "algoliasearch/lite"
import {
    latestPagesQueryKey,
    queryLatestPages,
    LatestPagesResult,
} from "../search/queries.js"
import type { PageChronologicalRecord } from "@ourworldindata/types"

const DEFAULT_PAGE_SIZE = 20

export function useInfiniteLatestPages({
    topics,
    contentType = null,
    kicker = null,
    liteSearchClient,
    pageSize = DEFAULT_PAGE_SIZE,
}: {
    topics: string[]
    contentType?: string | null
    kicker?: string | null
    liteSearchClient: LiteClient
    pageSize?: number
}) {
    const query = useInfiniteQuery<LatestPagesResult, Error>({
        queryKey: latestPagesQueryKey.latestPages(topics, contentType, kicker),
        queryFn: ({ pageParam }) => {
            if (typeof pageParam !== "number")
                throw new Error("Invalid pageParam")

            const offset = pageParam * pageSize
            return queryLatestPages(
                liteSearchClient,
                topics,
                offset,
                pageSize,
                contentType,
                kicker
            )
        },
        getNextPageParam: (lastPage, allPages) => {
            const totalFetched = allPages.reduce(
                (sum, page) => sum + page.response.hits.length,
                0
            )
            return totalFetched < (lastPage.response.nbHits ?? 0)
                ? allPages.length
                : undefined
        },
        initialPageParam: 0,
        placeholderData: keepPreviousData,
    })

    const hits: PageChronologicalRecord[] =
        query.data?.pages.flatMap((page) => page.response.hits) || []
    const totalResults = query.data?.pages[0]?.response.nbHits || 0
    const tagFacetCounts: Record<string, number> =
        query.data?.pages[0]?.tagFacetCounts || {}
    const typeFacetCounts: Record<string, number> =
        query.data?.pages[0]?.typeFacetCounts || {}
    const kickerFacetCounts: Record<string, number> =
        query.data?.pages[0]?.kickerFacetCounts || {}

    return {
        ...query,
        hits,
        totalResults,
        tagFacetCounts,
        typeFacetCounts,
        kickerFacetCounts,
    }
}
