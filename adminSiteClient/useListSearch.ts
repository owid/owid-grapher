import { useDeferredValue, useMemo } from "react"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    highlightFunctionForSearchWords,
} from "../adminShared/search.js"
import {
    SearchHighlighter,
    useSearchQueryParam,
} from "./variableSearchQuery.js"

interface ListSearch<T> {
    searchValue: string
    setSearchValue: (value: string) => void
    /** The rows every word of the search matches. */
    filtered: T[]
    highlight: SearchHighlighter
}

/**
 * The search shared by the admin's list pages: words, `"phrases"` and
 * `-exclusions` matched against the text `searchedText` picks out of each
 * row, with the search kept in the URL so a filtered list can be shared.
 *
 * `searchedText` should be stable (defined outside the component, or
 * memoized), since a new one filters the list again.
 */
export function useListSearch<T>(
    rows: readonly T[] | undefined,
    searchedText: (row: T) => (string | null | undefined)[]
): ListSearch<T> {
    const [searchValue, setSearchValue] = useSearchQueryParam()
    // Long lists take a moment to filter; the box shouldn't wait for them
    const deferredSearchValue = useDeferredValue(searchValue)
    const searchWords = useMemo(
        () => buildSearchWordsFromSearchString(deferredSearchValue),
        [deferredSearchValue]
    )
    const filtered = useMemo(
        () =>
            (rows ?? []).filter(
                filterFunctionForSearchWords(searchWords, searchedText)
            ),
        [rows, searchWords, searchedText]
    )
    const highlight = useMemo(
        () => highlightFunctionForSearchWords(searchWords),
        [searchWords]
    )
    return { searchValue, setSearchValue, filtered, highlight }
}
