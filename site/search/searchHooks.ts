import { FilterType, SearchState } from "./searchTypes.js"
import {
    getFilterNamesOfType,
    getSelectedTopic,
    getPaginationOffsetAndLength,
    getNbPaginatedItemsRequested,
} from "./searchUtils.js"
import { useSearchContext } from "./SearchContext.js"
import { flattenNonTopicNodes, Url } from "@ourworldindata/utils"
import { useInfiniteQuery } from "@tanstack/react-query"
import { SearchClient } from "algoliasearch"
import { SearchResponse } from "instantsearch.js"
import { useState, useEffect, useMemo, useCallback } from "react"
import { urlToSearchState, searchStateToUrl } from "./searchState.js"
import { TagGraphNode, TagGraphRoot } from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"

export const useSelectedTopic = (
    deferred: boolean = false
): string | undefined => {
    const { state, deferredState } = useSearchContext()
    return getSelectedTopic(deferred ? deferredState.filters : state.filters)
}

export const useSelectedRegionNames = (deferred: boolean = false): string[] => {
    const { state, deferredState } = useSearchContext()
    return Array.from(
        getFilterNamesOfType(
            deferred ? deferredState.filters : state.filters,
            FilterType.COUNTRY
        )
    )
}

/**
 * Extracts and memoizes area names and all topics from the topic tag graph
 */
export function useTagGraphTopics(topicTagGraph: TagGraphRoot | null): {
    allAreas: string[]
    allTopics: string[]
} {
    const allAreas = useMemo(
        () => topicTagGraph?.children.map((child) => child.name) || [],
        [topicTagGraph]
    )

    const allTopics = useMemo(() => {
        if (!topicTagGraph) return []

        function getAllTopics(node: TagGraphNode): Set<string> {
            return node.children.reduce((acc, child) => {
                if (child.isTopic) {
                    acc.add(child.name)
                }
                if (child.children.length) {
                    const topics = getAllTopics(child)
                    topics.forEach((topic) => acc.add(topic))
                }
                return acc
            }, new Set<string>())
        }
        return [...getAllTopics(topicTagGraph)]
    }, [topicTagGraph])

    return { allAreas, allTopics }
}

/**
 * Handles analytics tracking for search state changes
 */
export function useSearchStateAnalytics(
    state: SearchState,
    analytics: SiteAnalytics,
    isInitialUrlStateLoaded: boolean
): void {
    const stateAsUrl = searchStateToUrl(state)

    useEffect(() => {
        // Do not log analytics until the initial URL state has been loaded.
        if (!isInitialUrlStateLoaded) return
        // Reconstructing state from the `stateAsUrl` serialization to avoid a
        // `state` dependency in this effect, which would cause it to run on
        // every state change (even no-ops)
        const state = urlToSearchState(Url.fromURL(stateAsUrl))
        analytics.logSearch(state)
    }, [stateAsUrl, isInitialUrlStateLoaded, analytics])
}

/**
 * Handles bidirectional synchronization between search state and browser URL.
 *
 * - Reads initial URL state on mount (URL → state)
 * - Syncs state changes to URL (state → URL)
 * - Handles browser back/forward navigation (URL → state)
 *
 * Returns true when the initial URL state has been loaded. This flag prevents
 * firing default search queries unnecessarily. These default queries would only
 * be used if the loaded template happened to exactly match the default state
 * (no topic, no country, no query - see getInitialSearchState()). In most
 * cases, the URL will correspond to a different template, requiring a different
 * set of queries.
 */
export function useUrlSync(
    state: SearchState,
    setState: (state: SearchState) => void
): boolean {
    const [isInitialUrlStateLoaded, setIsInitialUrlStateLoaded] =
        useState(false)

    const getCurrentUrlData = useCallback(() => {
        const currentUrl = window.location.href
        const url = Url.fromURL(currentUrl)
        return {
            urlState: urlToSearchState(url),
            currentUrl,
        }
    }, [])

    // URL → State: Read initial URL state on mount
    useEffect(() => {
        const { urlState } = getCurrentUrlData()
        setState(urlState)
        setIsInitialUrlStateLoaded(true)
    }, [setState, getCurrentUrlData])

    // State → URL: Sync state changes to browser URL
    useEffect(() => {
        const stateAsUrl = searchStateToUrl(state)
        const { currentUrl } = getCurrentUrlData()
        // Do not push the transitory default state URL on page load. Also, only
        // set the url if it's different from the current url. When the user
        // navigates back, we derive the state from the url and set it so the
        // url is already identical to the state - we don't need to push it
        // again.
        if (isInitialUrlStateLoaded && currentUrl !== stateAsUrl) {
            window.history.pushState({}, "", stateAsUrl)
        }
    }, [state, getCurrentUrlData, isInitialUrlStateLoaded])

    // URL → State: Handle browser back/forward navigation
    useEffect(() => {
        const handlePopState = () => {
            const { urlState } = getCurrentUrlData()
            setState(urlState)
        }
        window.addEventListener("popstate", handlePopState)
        return () => window.removeEventListener("popstate", handlePopState)
    }, [setState, getCurrentUrlData])

    return isInitialUrlStateLoaded
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

export function useInfiniteSearchOffset<T extends SearchResponse<U>, U>({
    queryKey,
    queryFn,
    firstPageSize,
    laterPageSize,
    enabled = true,
}: {
    queryKey: (state: SearchState) => readonly (string | QueryKeyState)[]
    queryFn: (
        searchClient: SearchClient,
        state: SearchState,
        offset: number,
        length: number
    ) => Promise<T>
    firstPageSize: number
    laterPageSize: number
    enabled?: boolean
}) {
    const { state, searchClient } = useSearchContext()
    const query = useInfiniteQuery<T, Error>({
        queryKey: queryKey(state),
        queryFn: ({ pageParam = 0 }) => {
            const { offset, length } = getPaginationOffsetAndLength(
                pageParam,
                firstPageSize,
                laterPageSize
            )

            return queryFn(searchClient, state, offset, length)
        },
        getNextPageParam: (lastPage, allPages) => {
            const currentPageIndex = allPages.length - 1

            const requestedSoFar = getNbPaginatedItemsRequested(
                currentPageIndex,
                firstPageSize,
                laterPageSize,
                lastPage.hits.length
            )

            return requestedSoFar < lastPage.nbHits
                ? currentPageIndex + 1
                : undefined
        },
        enabled,
    })

    const hits: U[] = query.data?.pages.flatMap((page) => page.hits) || []
    const totalResults = query.data?.pages[0]?.nbHits || 0

    return {
        ...query,
        hits,
        totalResults,
    }
}

export function useInfiniteSearch<T extends SearchResponse<U>, U>({
    queryKey,
    queryFn,
    enabled = true,
}: {
    queryKey: (state: SearchState) => readonly (string | QueryKeyState)[]
    queryFn: (
        searchClient: SearchClient,
        state: SearchState,
        page: number
    ) => Promise<T>
    enabled?: boolean
}) {
    const { deferredState: state, searchClient } = useSearchContext()

    const query = useInfiniteQuery<T, Error>({
        // All paginated subqueries share the same query key
        queryKey: queryKey(state),
        queryFn: ({ pageParam = 0 }) => queryFn(searchClient, state, pageParam),
        getNextPageParam: (lastPage) => {
            const { page, nbPages } = lastPage
            return page < nbPages - 1 ? page + 1 : undefined
        },
        enabled,
    })

    const hits: U[] = query.data?.pages.flatMap((page) => page.hits) || []
    const totalResults = query.data?.pages[0]?.nbHits || 0

    return {
        ...query,
        hits,
        totalResults,
    }
}

export const useTopicTagGraph = () => {
    const [tagGraph, setTagGraph] = useState<TagGraphRoot | null>(null)

    useEffect(() => {
        const fetchTagGraph = async () => {
            const response = await fetch("/topicTagGraph.json")
            const tagGraph = await response.json()
            setTagGraph(flattenNonTopicNodes(tagGraph))
        }
        if (!tagGraph) {
            fetchTagGraph().catch((err) => {
                throw new Error(`Failed to fetch tag graph: ${err}`)
            })
        }
    }, [tagGraph, setTagGraph])

    return tagGraph
}
