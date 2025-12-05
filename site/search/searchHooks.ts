import {
    FilterType,
    SearchState,
    Filter,
    SearchResultType,
    SearchActions,
} from "@ourworldindata/types"
import {
    getFilterNamesOfType,
    getSelectedTopic,
    getPaginationOffsetAndLength,
    getNbPaginatedItemsRequested,
    createCountryFilter,
    createTopicFilter,
    removeMatchedWordsWithStopWords,
    splitIntoWords,
} from "./searchUtils.js"
import {
    searchParamsToState,
    stateToSearchParams,
    DEFAULT_SEARCH_STATE,
    urlNeedsSanitization,
} from "./searchState.js"
import { useSearchContext } from "./SearchContext.js"
import { flattenNonTopicNodes } from "@ourworldindata/utils"
import { useInfiniteQuery } from "@tanstack/react-query"
import { LiteClient } from "algoliasearch/lite"
import type { SearchResponse } from "instantsearch.js"
import { useState, useEffect, useMemo, useCallback } from "react"
import type { TagGraphNode, TagGraphRoot } from "@ourworldindata/types"
import { useSearchParams } from "react-router-dom-v5-compat"
import * as R from "remeda"
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
 * Handles analytics tracking for search state changes.
 */
export function useSearchAnalytics(
    state: SearchState,
    analytics: SiteAnalytics
): void {
    // Serialize state to string to use as effect dependency without
    // triggering on every render
    const stateKey = useMemo(
        () => stateToSearchParams(state).toString(),
        [state]
    )

    const defaultStateKey = useMemo(
        () => stateToSearchParams(DEFAULT_SEARCH_STATE).toString(),
        []
    )

    useEffect(() => {
        // Skip analytics for default/empty search state
        if (stateKey === defaultStateKey) return
        analytics.logSearch(state)
    }, [stateKey, defaultStateKey, analytics, state])
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

/**
 * Hook that manages search state via URL search params.
 *
 * Key design principle: URL is the source of truth. State is derived
 * synchronously from URL params.
 */
export function useSearchParamsState(
    validRegions: Set<string>,
    validTopics: Set<string>
): {
    state: SearchState
    actions: SearchActions
} {
    const [searchParams, setSearchParams] = useSearchParams()

    // Derive state from URL
    const state = useMemo(
        () => searchParamsToState(searchParams, validRegions, validTopics),
        [searchParams, validRegions, validTopics]
    )

    // Sanitize URL if it contains invalid values (e.g., unknown countries/topics)
    // Uses replace: true to avoid creating browser history entries
    useEffect(() => {
        if (urlNeedsSanitization(searchParams, state)) {
            setSearchParams(stateToSearchParams(state), { replace: true })
        }
    }, [searchParams, state, setSearchParams])

    // Helper to update params atomically
    const updateParams = useCallback(
        (updater: (current: SearchState) => SearchState) => {
            setSearchParams((prev) => {
                const currentState = searchParamsToState(
                    prev,
                    validRegions,
                    validTopics
                )
                const newState = updater(currentState)
                return stateToSearchParams(newState)
            })
        },
        [setSearchParams, validRegions, validTopics]
    )

    const actions = useMemo<SearchActions>(
        () => ({
            setQuery: (query: string) => {
                updateParams((s) => ({ ...s, query: query.trim() }))
            },

            addCountry: (country: string) => {
                updateParams((s) => {
                    const exists = s.filters.some(
                        (f) =>
                            f.type === FilterType.COUNTRY && f.name === country
                    )
                    if (exists) return s
                    return {
                        ...s,
                        filters: [...s.filters, createCountryFilter(country)],
                    }
                })
            },

            addCountryAndSetQuery: (country: string, query: string) => {
                updateParams((s) => {
                    const exists = s.filters.some(
                        (f) =>
                            f.type === FilterType.COUNTRY && f.name === country
                    )
                    return {
                        ...s,
                        query: query.trim(),
                        filters: exists
                            ? s.filters
                            : [...s.filters, createCountryFilter(country)],
                    }
                })
            },

            removeCountry: (country: string) => {
                updateParams((s) => {
                    const newFilters = s.filters.filter(
                        (f) =>
                            !(
                                f.type === FilterType.COUNTRY &&
                                f.name === country
                            )
                    )
                    const hasCountryFilters = newFilters.some(
                        (f) => f.type === FilterType.COUNTRY
                    )
                    return {
                        ...s,
                        filters: newFilters,
                        requireAllCountries: hasCountryFilters
                            ? s.requireAllCountries
                            : false,
                    }
                })
            },

            setTopic: (topic: string) => {
                updateParams((s) => {
                    const newFilters = s.filters.filter(
                        (f) => f.type !== FilterType.TOPIC
                    )
                    return {
                        ...s,
                        filters: [...newFilters, createTopicFilter(topic)],
                    }
                })
            },

            setTopicAndClearQuery: (topic: string) => {
                updateParams((s) => {
                    const newFilters = s.filters.filter(
                        (f) => f.type !== FilterType.TOPIC
                    )
                    return {
                        ...s,
                        query: "",
                        filters: [...newFilters, createTopicFilter(topic)],
                    }
                })
            },

            removeTopic: (topic: string) => {
                updateParams((s) => ({
                    ...s,
                    filters: s.filters.filter(
                        (f) =>
                            !(f.type === FilterType.TOPIC && f.name === topic)
                    ),
                }))
            },

            addFilter: (filter: Filter) => {
                updateParams((s) => {
                    const exists = s.filters.some(
                        (f) => f.type === filter.type && f.name === filter.name
                    )
                    if (exists) return s
                    return { ...s, filters: [...s.filters, filter] }
                })
            },

            removeFilter: (filter: Filter) => {
                updateParams((s) => {
                    const newFilters = s.filters.filter(
                        (f) =>
                            !(f.type === filter.type && f.name === filter.name)
                    )
                    const hasCountryFilters = newFilters.some(
                        (f) => f.type === FilterType.COUNTRY
                    )
                    return {
                        ...s,
                        filters: newFilters,
                        requireAllCountries:
                            filter.type === FilterType.COUNTRY &&
                            !hasCountryFilters
                                ? false
                                : s.requireAllCountries,
                    }
                })
            },

            toggleRequireAllCountries: () => {
                updateParams((s) => ({
                    ...s,
                    requireAllCountries: !s.requireAllCountries,
                }))
            },

            setResultType: (resultType: SearchResultType) => {
                updateParams((s) => ({ ...s, resultType }))
            },

            replaceQueryWithFilters: (
                filters: Filter[],
                matchedPositions: number[]
            ) => {
                updateParams((s) => {
                    const queryWords = splitIntoWords(s.query)
                    const newQuery = removeMatchedWordsWithStopWords(
                        queryWords,
                        matchedPositions
                    )

                    const allFilters = [...s.filters, ...filters]
                    const uniqueFilters = R.uniqueBy(
                        allFilters,
                        (f) => `${f.type}:${f.name}`
                    )

                    return {
                        ...s,
                        query: newQuery.trim(),
                        filters: uniqueFilters,
                    }
                })
            },

            reset: () => {
                setSearchParams(new URLSearchParams())
            },
        }),
        [updateParams, setSearchParams]
    )

    return { state, actions }
}
