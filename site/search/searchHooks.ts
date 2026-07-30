import { FilterType, SearchState } from "@ourworldindata/types"
import {
    getFilterNamesOfType,
    getSelectedTopic,
    getPaginationOffsetAndLength,
    getNbPaginatedItemsRequested,
} from "./searchUtils.js"
import { DEFAULT_SEARCH_STATE } from "./searchState.js"
import { useSearchContext } from "./SearchContext.js"
import { searchQueryKeys } from "./queries.js"
import { fetchJson, flattenNonTopicNodes } from "@ourworldindata/utils"
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { LiteClient } from "algoliasearch/lite"
import type { SearchResponse } from "algoliasearch"
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from "react"
import type { TagGraphNode, TagGraphRoot } from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"
import * as R from "remeda"

export function useSelectedTopic() {
    const { state } = useSearchContext()
    return getSelectedTopic(state.filters)
}

export function useSelectedRegionNames() {
    const { state } = useSearchContext()
    return Array.from(getFilterNamesOfType(state.filters, FilterType.COUNTRY))
}

/**
 * Extracts and memoizes area names and all searchable tags from the topic tag graph.
 * Searchable tags include both topics (tags with a topic page) and tags with searchableInAlgolia set.
 */
export function useTagGraphTopics(topicTagGraph?: TagGraphRoot) {
    const allAreas = useMemo(
        () => topicTagGraph?.children.map((child) => child.name) || [],
        [topicTagGraph]
    )

    const allTopics = useMemo(() => {
        if (!topicTagGraph) return []

        function getAllSearchableTopics(node: TagGraphNode) {
            return node.children.reduce((acc, child) => {
                if (child.isSearchable) {
                    acc.add(child.name)
                }
                if (child.children.length) {
                    const topics = getAllSearchableTopics(child)
                    topics.forEach((topic) => acc.add(topic))
                }
                return acc
            }, new Set<string>())
        }
        return [...getAllSearchableTopics(topicTagGraph)]
    }, [topicTagGraph])

    return { allAreas, allTopics }
}

/**
 * Handles analytics tracking for search state changes.
 */
export function useSearchAnalytics(
    state: SearchState,
    analytics: SiteAnalytics
) {
    const lastLoggedStateRef = useRef<SearchState | null>(null)

    useEffect(() => {
        // Skip analytics for the initial default/empty page load, but keep
        // tracking later transitions back to the default state. Updating the
        // ref here lets us track repeated filter states separated by a reset,
        // e.g. A -> default -> A.
        if (
            lastLoggedStateRef.current === null &&
            R.isDeepEqual(state, DEFAULT_SEARCH_STATE)
        ) {
            lastLoggedStateRef.current = state
            return
        }
        // Skip if we already logged this state
        if (R.isDeepEqual(state, lastLoggedStateRef.current)) return

        lastLoggedStateRef.current = state
        analytics.logSearch(state)
    }, [state, analytics])
}

type QueryKeyState = Pick<
    SearchState,
    "query" | "filters" | "requireAllCountries"
>

/**
 * Compute Algolia `offset` and `length` so the UI can show a smaller
 * first page (e.g. 2) and larger subsequent pages (e.g. 6) without
 * skipping results.
 *
 * Rationale:
 * - Using different `hitsPerPage` values together with Algolia's `page`
 *   parameter creates gaps: Algolia computes start = page * hitsPerPage,
 *   so switching page sizes means some indices are never requested and thus
 *   skipped.
 * - To avoid skipped results we request explicit `offset` and `length`:
 *   "start at result N and give me M results".
 *
 * Example (articles: first=2 later=6):
 * - UI page 0 -> offset=0, length=2 -> results 0..1
 * - UI page 1 -> offset=2, length=6 -> results 2..7
 * - UI page 2 -> offset=8, length=6 -> results 8..13
 */

export function useInfiniteSearchOffset<THit>({
    queryKey,
    queryFn,
    firstPageSize,
    laterPageSize,
    enabled = true,
}: {
    queryKey: (state: SearchState) => readonly (string | QueryKeyState)[]
    queryFn: (
        liteSearchClient: LiteClient,
        state: SearchState,
        offset: number,
        length: number
    ) => Promise<SearchResponse<THit>>
    firstPageSize: number
    laterPageSize: number
    enabled?: boolean
}) {
    const { state, liteSearchClient } = useSearchContext()
    const query = useInfiniteQuery({
        queryKey: queryKey(state),
        queryFn: ({ pageParam }) => {
            if (typeof pageParam !== "number")
                throw new Error("Invalid pageParam")

            const { offset, length } = getPaginationOffsetAndLength(
                pageParam,
                firstPageSize,
                laterPageSize
            )

            return queryFn(liteSearchClient, state, offset, length)
        },
        getNextPageParam: (lastPage, allPages) => {
            const currentPageIndex = allPages.length - 1

            const requestedSoFar = getNbPaginatedItemsRequested(
                currentPageIndex,
                firstPageSize,
                laterPageSize,
                lastPage.hits.length
            )

            return requestedSoFar < (lastPage.nbHits ?? 0)
                ? currentPageIndex + 1
                : undefined
        },
        enabled,
        initialPageParam: 0,
    })

    const hits = query.data?.pages.flatMap((page) => page.hits) || []
    const totalResults = query.data?.pages[0]?.nbHits || 0
    // Set by the closest-matches fallback in queries.ts: the section shows
    // relaxed ("did you mean"-style) results because the exact search was empty.
    const isClosestMatches = Boolean(
        (query.data?.pages[0] as { closestMatches?: boolean } | undefined)
            ?.closestMatches
    )

    return {
        ...query,
        hits,
        totalResults,
        isClosestMatches,
    }
}

export function useInfiniteSearch<THit>({
    queryKey,
    queryFn,
    enabled = true,
}: {
    queryKey: (state: SearchState) => readonly (string | QueryKeyState)[]
    queryFn: (
        liteSearchClient: LiteClient,
        state: SearchState,
        page: number
    ) => Promise<SearchResponse<THit>>
    enabled?: boolean
}) {
    const { state, liteSearchClient } = useSearchContext()

    const query = useInfiniteQuery({
        // All paginated subqueries share the same query key
        queryKey: queryKey(state),
        queryFn: ({ pageParam }) => {
            if (typeof pageParam !== "number")
                throw new Error("Invalid pageParam")

            return queryFn(liteSearchClient, state, pageParam)
        },
        getNextPageParam: (lastPage) => {
            const { page = 0, nbPages = 1 } = lastPage
            return page < nbPages - 1 ? page + 1 : undefined
        },
        initialPageParam: 0,
        enabled,
    })

    const hits = query.data?.pages.flatMap((page) => page.hits) || []
    const totalResults = query.data?.pages[0]?.nbHits || 0
    // Set by the closest-matches fallback in queries.ts: the section shows
    // relaxed ("did you mean"-style) results because the exact search was empty.
    const isClosestMatches = Boolean(
        (query.data?.pages[0] as { closestMatches?: boolean } | undefined)
            ?.closestMatches
    )

    return {
        ...query,
        hits,
        totalResults,
        isClosestMatches,
    }
}

/**
 * True when any of the Algolia queries for the current search state failed
 * (e.g. Algolia is down or blocking us). Every results component renders
 * nothing when its query fails, so without this the page falls back to the
 * "no results for this query" notice, which misrepresents an outage as an
 * empty index — see `SearchError`.
 *
 * The query cache is shared site-wide and holds on to failed queries until
 * they are garbage collected, so this only counts failures that are both
 * keyed to the current search state and still observed by a mounted
 * component. Without the observer check, a charts query that failed under
 * the Data toggle would keep the notice up after a switch to Writing, whose
 * template doesn't render charts at all — `resultType` is deliberately not
 * part of the query keys.
 */
export function useHasSearchError(state: SearchState): boolean {
    const queryCache = useQueryClient().getQueryCache()

    const getSnapshot = () =>
        [
            searchQueryKeys.charts(state),
            searchQueryKeys.dataTopics(state),
            searchQueryKeys.dataInsights(state),
            searchQueryKeys.articles(state),
            searchQueryKeys.topicPages(state),
            searchQueryKeys.writingTopics(state),
            searchQueryKeys.profiles(state),
        ].some((queryKey) => {
            const query = queryCache.find({ queryKey, exact: true })
            return (
                query?.state.status === "error" && query.getObserversCount() > 0
            )
        })

    return useSyncExternalStore(
        useCallback(
            (onStoreChange) => queryCache.subscribe(onStoreChange),
            [queryCache]
        ),
        getSnapshot,
        // No query has run during server rendering
        () => false
    )
}

export function useTopicTagGraph({ isPreviewing }: { isPreviewing: boolean }) {
    return useQuery({
        queryKey: ["topic-tag-graph", isPreviewing],
        queryFn: async () => {
            const url = isPreviewing
                ? "/admin/api/topicTagGraph.json"
                : "/topicTagGraph.json"
            const tagGraph = await fetchJson<TagGraphRoot>(url)
            return flattenNonTopicNodes(tagGraph)
        },
        staleTime: Infinity,
    })
}
