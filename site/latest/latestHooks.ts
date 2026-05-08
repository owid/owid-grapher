import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query"
import { LiteClient } from "algoliasearch/lite"
import { useEffect, useRef } from "react"
import * as R from "remeda"
import {
    latestPagesQueryKey,
    queryLatestPages,
    LatestPagesResult,
} from "../search/queries.js"
import {
    DEFAULT_LATEST_STATE,
    type LatestState,
    type LatestType,
    type PageChronologicalRecord,
} from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"

const DEFAULT_PAGE_SIZE = 20

/**
 * Handles analytics tracking for /latest filter state changes.
 * Mirrors useSearchAnalytics in site/search/searchHooks.ts.
 */
export function useLatestAnalytics(
    state: LatestState,
    analytics: SiteAnalytics
): void {
    const lastLoggedStateRef = useRef<LatestState | null>(null)

    useEffect(() => {
        // Skip analytics for default/empty state (initial page load).
        if (R.isDeepEqual(state, DEFAULT_LATEST_STATE)) return
        // Skip if we already logged this state.
        if (R.isDeepEqual(state, lastLoggedStateRef.current)) return

        lastLoggedStateRef.current = state
        analytics.logLatest(state)
    }, [state, analytics])
}

export function useInfiniteLatestPages({
    topics,
    latestType = null,
    liteSearchClient,
    pageSize = DEFAULT_PAGE_SIZE,
}: {
    topics: string[]
    latestType?: LatestType | null
    liteSearchClient: LiteClient
    pageSize?: number
}) {
    const query = useInfiniteQuery<LatestPagesResult, Error>({
        queryKey: latestPagesQueryKey.latestPages(topics, latestType),
        queryFn: ({ pageParam }) => {
            if (typeof pageParam !== "number")
                throw new Error("Invalid pageParam")

            const offset = pageParam * pageSize
            return queryLatestPages(
                liteSearchClient,
                topics,
                offset,
                pageSize,
                latestType
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
    const latestTypeFacetCounts: Record<string, number> =
        query.data?.pages[0]?.latestTypeFacetCounts || {}

    return {
        ...query,
        hits,
        totalResults,
        tagFacetCounts,
        latestTypeFacetCounts,
    }
}
