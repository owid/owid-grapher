import * as _ from "lodash-es"
import { useSyncExternalStore } from "react"

// Feature flag for which indicator-switcher UI to render on multi-indicator
// data pages. Override per-request via the URL query string,
// e.g. `?switcher=h-tabs` or `?switcher=v-tabs`.
export type SwitcherVariant = "dropdown" | "h-tabs" | "v-tabs" | "h-pills"

const DEFAULT_SWITCHER_VARIANT: SwitcherVariant = "h-pills"
const ALL_SWITCHER_VARIANTS: readonly SwitcherVariant[] = [
    "dropdown",
    "h-tabs",
    "v-tabs",
    "h-pills",
]

const readSwitcherVariant = (): SwitcherVariant => {
    const raw = new URLSearchParams(window.location.search).get("switcher")
    // "v-pills" is what you'd guess from "h-pills", so accept it as an
    // alias for the vertical variant (which is styled as tabs, not pills).
    const v = raw === "v-pills" ? "v-tabs" : raw
    return v && ALL_SWITCHER_VARIANTS.includes(v as SwitcherVariant)
        ? (v as SwitcherVariant)
        : DEFAULT_SWITCHER_VARIANT
}

// The query string doesn't change while the page is open, so there is
// nothing to subscribe to. The server snapshot keeps the server render and
// hydration on the default; React then re-renders with the URL's variant.
const subscribe = (): (() => void) => _.noop

export const useSwitcherVariant = (): SwitcherVariant =>
    useSyncExternalStore(
        subscribe,
        readSwitcherVariant,
        () => DEFAULT_SWITCHER_VARIANT
    )
