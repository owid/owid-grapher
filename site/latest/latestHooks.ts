import {
    keepPreviousData,
    queryOptions,
    useInfiniteQuery,
    useQueries,
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
import { OwidGdocType } from "@ourworldindata/utils"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { match } from "ts-pattern"
import { SiteAnalytics } from "../SiteAnalytics.js"

const DEFAULT_PAGE_SIZE = 20

/*
 * Bake probes.
 *
 * Publishing updates the Algolia index synchronously, but the published
 * item's standalone page only exists once the next site bake completes — so
 * for a while, a freshly published card would link to a 404. During a grace
 * period after publish (`FRESH_WINDOW_MS`) we therefore HEAD-probe a card's
 * page and don't show the card until the probe comes back 200; past the
 * window we assume the bake has caught up.
 *
 * Two consumers share the probes through the query cache:
 *
 * - each card gates its own rendering on `useIsLikelyBaked`;
 * - `LatestSearch` holds its loading skeleton until `useAreFreshProbesSettled`
 *   reports every first-page probe answered, so that the feed renders in one
 *   commit with its composition final. Without this, gated cards mount late:
 *   scrolling to a `/latest#slug` deeplink misses its anchor, and cards
 *   popping in shift the feed under the reader.
 */

export const FRESH_WINDOW_MS = 60 * 60 * 1000

const isFreshlyPublished = (publishedAt: string | Date): boolean =>
    Date.now() - new Date(publishedAt).getTime() < FRESH_WINDOW_MS

// Shared by both probe consumers — identical query keys are what make their
// fetches dedupe.
const isLikelyBakedQueryOptions = (href: string) =>
    queryOptions({
        queryKey: ["isLikelyBaked", href],
        queryFn: async () => {
            // Resolve 404s as a final `false` rather than throwing — React
            // Query only retries on rejected promises, so this caches the 404
            // for the session. Network errors still throw and get the default
            // retry/backoff treatment.
            const res = await fetch(href, { method: "HEAD" })
            return res.ok
        },
        staleTime: Infinity,
    })

/**
 * The URL a hit's probe checks, or null for card types that render ungated.
 * Sole source of the probe URL, so both consumers necessarily fire the same
 * queries — and exhaustive over the hit types, so adding one forces a
 * decision here about whether it gates.
 *
 * Always the hit's standalone page — the one destination whose existence
 * depends on this publish's bake. A card may link elsewhere in some states
 * (a data update's expanded CTA points at a pre-existing data page), but
 * those destinations can't 404 from a pending bake, and expansion state can
 * change under the reader, so the standalone page is what we vet.
 */
function getProbeHref(hit: PageChronologicalRecord): string | null {
    return match(hit)
        .with(
            { type: OwidGdocType.Article },
            { type: OwidGdocType.DataInsight },
            // Data updates link out to their announcement page; plain
            // announcements render their content inline and don't gate.
            { type: OwidGdocType.Announcement, latestType: "data-update" },
            (hit) =>
                getPrefixedGdocPath("", {
                    slug: hit.slug,
                    content: { type: hit.type },
                })
        )
        .with({ type: OwidGdocType.Announcement }, () => null)
        .with(
            { type: OwidGdocType.TopicPage },
            { type: OwidGdocType.LinearTopicPage },
            () => null
        )
        .exhaustive()
}

/**
 * Whether it's safe to show this hit's card (see "Bake probes" above).
 * True unless the hit is gated — fresh, of a type that links to its own
 * standalone page — and its probe hasn't come back 200. Heuristic by design:
 * past the grace period this returns true without verifying anything.
 */
export function useIsLikelyBaked(hit: PageChronologicalRecord): boolean {
    const probeHref = getProbeHref(hit)
    const needsProbe = probeHref !== null && isFreshlyPublished(hit.date)

    const { data } = useQuery({
        ...isLikelyBakedQueryOptions(probeHref ?? ""),
        enabled: needsProbe,
    })

    return !needsProbe || data === true
}

/**
 * Whether every fresh hit on the given page has a settled bake probe — the
 * signal `LatestSearch` extends its skeleton on (see "Bake probes" above).
 * Runs the probes itself so they start before any card mounts; the cards'
 * own `useIsLikelyBaked` calls then read them from the cache.
 *
 * Pass the first page only. The feed is chronological, so fresh hits are
 * always among the newest — and "load more" pages must never re-trigger the
 * skeleton.
 */
export function useAreFreshProbesSettled(
    hits: PageChronologicalRecord[]
): boolean {
    const results = useQueries({
        queries: hits
            .filter((hit) => isFreshlyPublished(hit.date))
            .map(getProbeHref)
            .filter((href) => href !== null)
            .map(isLikelyBakedQueryOptions),
    })
    return results.every((result) => !result.isPending)
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
