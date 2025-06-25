import { FilterType, SearchState } from "./searchTypes.js"
import {
    getCountryData,
    getFilterNamesOfType,
    getSelectedTopic,
} from "./searchUtils.js"
import { useSearchContext } from "./SearchContext.js"
import { Region, Url } from "@ourworldindata/utils"
import { useInfiniteQuery } from "@tanstack/react-query"
import { SearchClient } from "algoliasearch"
import { SearchResponse } from "instantsearch.js"
import { useState, useEffect, useMemo, useCallback } from "react"
import { urlToSearchState, searchStateToUrl } from "./searchState.js"
import { TagGraphNode, TagGraphRoot } from "@ourworldindata/types"
import { SiteAnalytics } from "../SiteAnalytics.js"

export const useSelectedCountries = (): Region[] => {
    const selectedCountryNames = useSelectedCountryNames()
    return getCountryData(selectedCountryNames)
}

export const useSelectedTopic = (): string | undefined => {
    const { state } = useSearchContext()
    return getSelectedTopic(state.filters)
}

export const useSelectedCountryNames = (): Set<string> => {
    const { state } = useSearchContext()
    return getFilterNamesOfType(state.filters, FilterType.COUNTRY)
}

/**
 * Extracts and memoizes area names and all topics from the topic tag graph
 */
export function useTagGraphTopics(topicTagGraph: TagGraphRoot): {
    allAreas: string[]
    allTopics: string[]
} {
    const allAreas = useMemo(
        () => topicTagGraph.children.map((child) => child.name) || [],
        [topicTagGraph]
    )

    const allTopics = useMemo(() => {
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
export function useSearchAnalytics(
    state: SearchState,
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
        const analytics = new SiteAnalytics()
        analytics.logDataCatalogSearch(state)
    }, [stateAsUrl, isInitialUrlStateLoaded])
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

export function useInfiniteSearch<T extends SearchResponse<U>, U>({
    queryKey,
    queryFn,
}: {
    queryKey: (state: SearchState) => readonly (string | SearchState)[]
    queryFn: (searchClient: SearchClient, state: SearchState) => Promise<T>
}) {
    const { state, searchClient } = useSearchContext()

    const query = useInfiniteQuery<T, Error>({
        // Create a state with a static page param so that a single cache entry
        // is shared across all pages
        queryKey: queryKey({ ...state, page: 0 }),
        queryFn: ({ pageParam = 0 }) =>
            queryFn(searchClient, { ...state, page: pageParam }),
        getNextPageParam: (lastPage) => {
            const { page, nbPages } = lastPage
            return page < nbPages - 1 ? page + 1 : undefined
        },
    })

    const hits: U[] = query.data?.pages.flatMap((page) => page.hits) || []
    const totalResults = query.data?.pages[0]?.nbHits || 0

    return {
        ...query,
        hits,
        totalResults,
    }
}
