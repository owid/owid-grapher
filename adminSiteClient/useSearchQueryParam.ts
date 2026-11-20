import { useCallback } from "react"
import { useSearchParams } from "react-router-dom-v5-compat"
import { SEARCH_PARAM } from "./variableSearchQuery.js"

// Apart from variableSearchQuery.ts, which the chart editor package bundles
// without the admin's router

/**
 * Keeps the search in the URL, so a filtered list can be bookmarked, shared
 * and restored by the back button.
 */
export function useSearchQueryParam(): [
    string,
    (value: string, options?: { push?: boolean }) => void,
] {
    const [searchParams, setSearchParams] = useSearchParams()
    const value = searchParams.get(SEARCH_PARAM) ?? ""

    const setValue = useCallback(
        (nextValue: string, options?: { push?: boolean }) =>
            setSearchParams(
                (params) => {
                    if (nextValue) params.set(SEARCH_PARAM, nextValue)
                    else params.delete(SEARCH_PARAM)
                    return params
                },
                // Typing replaces, or every keystroke would be a step back; a
                // link that narrows the search is a step, so Back returns from it
                { replace: !options?.push }
            ),
        [setSearchParams]
    )

    return [value, setValue]
}
