import type * as React from "react"
import { useCallback, useMemo } from "react"
import { useHistory, useLocation } from "react-router-dom"
import { highlightFunctionForSearchWords } from "../adminShared/search.js"
import {
    describeSearchFields,
    makeSearchFilter,
    SearchField,
    searchWordsToHighlight,
} from "../adminShared/searchFilter.js"
import type { AdminTableSearch } from "./AdminTable.js"

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
            const params = new URLSearchParams(location.search)
            if (nextValue) params.set(key, nextValue)
            else params.delete(key)
            const query = params.toString()
            // `location.pathname` is relative to the router's basename, unlike
            // `window.location.pathname`, which would double up the /admin prefix
            history.replace({
                pathname: location.pathname,
                search: query ? `?${query}` : "",
            })
        },
        [history, key, location.pathname, location.search]
    )

    return [value, setValue]
}

export type SearchHighlighter = (
    text: string | null | undefined
) => React.ReactElement | string

/**
 * Everything a list page needs for its search box: the query (kept in the URL),
 * the filtered rows, and a highlighter for the columns that show matched text.
 *
 * `fields` declares what `field:value` terms the page understands; pass a
 * module-level constant so the filtering isn't redone on every render.
 */
export function useListSearch<T>(
    items: readonly T[] | undefined,
    fields: readonly SearchField<T>[],
    options: {
        placeholder?: string
        autoFocus?: boolean
        /** Query parameter to keep the search in. Defaults to `search`. */
        paramName?: string
    } = {}
): {
    results: T[]
    highlight: SearchHighlighter
    search: AdminTableSearch
} {
    const [value, onChange] = useSearchQueryParam(options.paramName)

    const results = useMemo(() => {
        const matches = makeSearchFilter(value, fields)
        return (items ?? []).filter(matches)
    }, [items, value, fields])

    const highlight = useMemo(
        () =>
            highlightFunctionForSearchWords(
                searchWordsToHighlight(value, fields)
            ),
        [value, fields]
    )

    const search = useMemo(
        () => ({
            value,
            onChange,
            placeholder: options.placeholder,
            autoFocus: options.autoFocus,
            fields: describeSearchFields(fields),
        }),
        [value, onChange, options.placeholder, options.autoFocus, fields]
    )

    return { results, highlight, search }
}
