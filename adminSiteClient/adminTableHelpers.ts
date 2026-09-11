import type * as React from "react"
import { useCallback } from "react"
import { useHistory, useLocation } from "react-router-dom"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"

export const ADMIN_TABLE_PAGE_SIZE = 50

/**
 * Keeps a search string in the URL query so that a filtered list can be
 * bookmarked, shared and restored by the back button.
 */
export function useSearchQueryParam(
    key: string = "search"
): [string, (value: string) => void] {
    const location = useLocation()
    const history = useHistory()
    const value = new URLSearchParams(location.search).get(key) ?? ""

    const setValue = useCallback(
        (nextValue: string) => {
            const params = new URLSearchParams(window.location.search)
            if (nextValue) params.set(key, nextValue)
            else params.delete(key)
            const query = params.toString()
            history.replace({
                pathname: window.location.pathname,
                search: query ? `?${query}` : "",
            })
        },
        [history, key]
    )

    return [value, setValue]
}

/**
 * Filters items with the admin's shared search syntax (space-separated terms,
 * quoted phrases, `-exclusions`), matching against the given fields.
 */
export function filterBySearchWords<T>(
    items: readonly T[],
    searchValue: string,
    getSearchableFields: (item: T) => (string | null | undefined)[]
): T[] {
    const searchWords = buildSearchWordsFromSearchString(searchValue)
    if (searchWords.length === 0) return [...items]
    const filterFn = filterFunctionForSearchWords(searchWords, (item: T) =>
        getSearchableFields(item).map((field) => field ?? undefined)
    )
    return items.filter(filterFn)
}

export type SearchHighlighter = (
    text: string | null | undefined
) => React.ReactElement | string

/** Highlights the matches of a search string, for use in a column renderer. */
export function highlightSearchWords(searchValue: string): SearchHighlighter {
    return highlightFunctionForSearchWords(
        buildSearchWordsFromSearchString(searchValue)
    )
}
