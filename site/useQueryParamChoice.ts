import * as _ from "lodash-es"
import { useSyncExternalStore } from "react"

// The query string doesn't change while the page is open, so there is
// nothing to subscribe to.
const subscribe = (): (() => void) => _.noop

/**
 * One of `choices`, read from the `name` query parameter in the browser
 * (QA overrides like `?switcher=h-tabs`). The server snapshot keeps the
 * server render and hydration on `fallback`; React then re-renders with the
 * URL's choice. `aliases` maps other accepted spellings onto a choice.
 */
export const useQueryParamChoice = <T extends string>(
    name: string,
    choices: readonly T[],
    fallback: T,
    aliases: Record<string, T> = {}
): T =>
    useSyncExternalStore(
        subscribe,
        () => {
            const raw = new URLSearchParams(window.location.search).get(name)
            const value = (raw && aliases[raw]) || raw
            return value && choices.includes(value as T)
                ? (value as T)
                : fallback
        },
        () => fallback
    )
