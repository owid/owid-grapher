import { FilterType, SearchState } from "@ourworldindata/types"
import {
    getFilterNamesOfType,
    getSelectedTopic,
    getPaginationOffsetAndLength,
    getNbPaginatedItemsRequested,
} from "./searchUtils.js"
import { DEFAULT_SEARCH_STATE } from "./searchState.js"
import { useSearchContext } from "./SearchContext.js"
import { flattenNonTopicNodes } from "@ourworldindata/utils"
import { useInfiniteQuery } from "@tanstack/react-query"
import { LiteClient } from "algoliasearch/lite"
import type { SearchResponse } from "instantsearch.js"
import { useState, useEffect, useMemo, useRef } from "react"
import type { TagGraphNode, TagGraphRoot } from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"
import * as R from "remeda"

export const useSelectedTopic = (): string | undefined => {
    const { state } = useSearchContext()
    return getSelectedTopic(state.filters)
}

export const useSelectedRegionNames = (): string[] => {
    const { state } = useSearchContext()
    return Array.from(getFilterNamesOfType(state.filters, FilterType.COUNTRY))
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
 * Handles analytics tracking for search state changes.
 */
export function useSearchAnalytics(
    state: SearchState,
    analytics: SiteAnalytics
): void {
    const lastLoggedStateRef = useRef<SearchState | null>(null)

    useEffect(() => {
        // Skip analytics for default/empty search state
        if (R.isDeepEqual(state, DEFAULT_SEARCH_STATE)) return
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

export function useInfiniteSearchOffset<T extends SearchResponse<U>, U>({
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
    ) => Promise<T>
    firstPageSize: number
    laterPageSize: number
    enabled?: boolean
}) {
    const { state, liteSearchClient } = useSearchContext()
    const query = useInfiniteQuery<T, Error>({
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
        liteSearchClient: LiteClient,
        state: SearchState,
        page: number
    ) => Promise<T>
    enabled?: boolean
}) {
    const { state, liteSearchClient } = useSearchContext()

    const query = useInfiniteQuery<T, Error>({
        // All paginated subqueries share the same query key
        queryKey: queryKey(state),
        queryFn: ({ pageParam }) => {
            if (typeof pageParam !== "number")
                throw new Error("Invalid pageParam")

            return queryFn(liteSearchClient, state, pageParam)
        },
        getNextPageParam: (lastPage) => {
            let { page, nbPages } = lastPage
            page = page ?? 0
            nbPages = nbPages ?? 1
            return page < nbPages - 1 ? page + 1 : undefined
        },
        initialPageParam: 0,
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
