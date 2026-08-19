import {
    keepPreviousData,
    useInfiniteQuery,
    useQuery,
} from "@tanstack/react-query"
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

// Grace period after a publish during which we don't trust that the article's
// static page exists yet, and HEAD-probe before showing its card on /latest.
// Past this window we assume the bake has caught up.
export const FRESH_WINDOW_MS = 60 * 60 * 1000

/**
 * For freshly-published cards, probe whether the card URL is reachable before
 * showing it — the Algolia index is updated synchronously on publish but the
 * static page is only available once the next bake completes, so a card can
 * otherwise link to a 404.
 *
 * Returns `true` once we're confident the link is safe (either the publish is
 * older than `FRESH_WINDOW_MS` or a HEAD probe came back 200). Returns `false`
 * while we're still uncertain. Heuristic by design — past the grace period the
 * hook returns `true` without verifying anything.
 */
export function useIsLikelyBaked(
    href: string,
    publishedAt: string | Date
): boolean {
    const isFresh =
        Date.now() - new Date(publishedAt).getTime() < FRESH_WINDOW_MS

    const { data } = useQuery({
        queryKey: ["isLikelyBaked", href],
        queryFn: async () => {
            // Resolve 404s as a final `false` rather than throwing — React
            // Query only retries on rejected promises, so this caches the 404
            // for the session. Network errors still throw and get the default
            // retry/backoff treatment.
            const res = await fetch(href, { method: "HEAD" })
            return res.ok
        },
        enabled: isFresh,
        staleTime: Infinity,
    })

    return !isFresh || data === true
}

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
        // Skip analytics for the initial default/empty page load, but keep
        // tracking later transitions back to the default state. Updating the
        // ref here lets us track repeated filter states separated by a reset,
        // e.g. A -> default -> A. This can help inform the need for a visible
        // reset button.
        if (
            lastLoggedStateRef.current === null &&
            R.isDeepEqual(state, DEFAULT_LATEST_STATE)
        ) {
            lastLoggedStateRef.current = state
            return
        }
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
