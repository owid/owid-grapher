import * as _ from "lodash-es"
import { useSyncExternalStore } from "react"

// The query string doesn't change while the page is open, so there is
// nothing to subscribe to.
const subscribe = (): (() => void) => _.noop

/**
 * The one of `choices` that the `name` query parameter gives, or `fallback`.
 * The server render and hydration use `fallback`, and React then re-renders
 * with the URL's choice.
 */
export const useQueryParamChoice = <T extends string>(
    name: string,
    choices: readonly T[],
    fallback: T
): T =>
    useSyncExternalStore(
        subscribe,
        () => {
            const value = new URLSearchParams(window.location.search).get(name)
            return choices.find((choice) => choice === value) ?? fallback
        },
        () => fallback
    )
