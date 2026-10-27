import type * as React from "react"
import { useMemo } from "react"
import { highlightFunctionForSearchWords } from "../adminShared/search.js"
import {
    makeSearchFilter,
    SearchField,
    searchWordsToHighlight,
} from "../adminShared/searchFilter.js"
import type { AdminTableSearch } from "./AdminTable.js"
import { useSearchQueryParam } from "./variableSearchQuery.js"

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
    } = {}
): {
    results: T[]
    highlight: SearchHighlighter
    search: AdminTableSearch
} {
    const [value, onChange] = useSearchQueryParam()

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
            onChange: (next: string) => onChange(next),
            placeholder: options.placeholder,
            autoFocus: options.autoFocus,
            fields,
        }),
        [value, onChange, options.placeholder, options.autoFocus, fields]
    )

    return { results, highlight, search }
}
