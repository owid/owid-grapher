import { useCallback } from "react"
import { useHistory, useLocation } from "react-router-dom"
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
    const location = useLocation()
    const history = useHistory()
    const value = new URLSearchParams(location.search).get(SEARCH_PARAM) ?? ""

    const setValue = useCallback(
        (nextValue: string, options?: { push?: boolean }) => {
            const params = new URLSearchParams(location.search)
            if (nextValue) params.set(SEARCH_PARAM, nextValue)
            else params.delete(SEARCH_PARAM)
            const query = params.toString()
            // `location.pathname` is relative to the router's basename, unlike
            // `window.location.pathname`, which would double up the /admin prefix
            const next = {
                pathname: location.pathname,
                search: query ? `?${query}` : "",
            }
            // Typing replaces, or every keystroke would be a step back; a link
            // that narrows the search is a step, so Back returns from it
            if (options?.push) history.push(next)
            else history.replace(next)
        },
        [history, location.pathname, location.search]
    )

    return [value, setValue]
}
