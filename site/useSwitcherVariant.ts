import { useQueryParamChoice } from "./useQueryParamChoice.js"

// Feature flag for which indicator-switcher UI to render on multi-indicator
// data pages. Override per-request via the URL query string,
// e.g. `?switcher=h-tabs` or `?switcher=v-tabs`.
export type SwitcherVariant = "dropdown" | "h-tabs" | "v-tabs" | "h-pills"

const ALL_SWITCHER_VARIANTS: readonly SwitcherVariant[] = [
    "dropdown",
    "h-tabs",
    "v-tabs",
    "h-pills",
]

// "v-pills" is what you'd guess from "h-pills", so accept it as an alias for
// the vertical variant (which is styled as tabs, not pills).
export const useSwitcherVariant = (): SwitcherVariant =>
    useQueryParamChoice("switcher", ALL_SWITCHER_VARIANTS, "h-pills", {
        "v-pills": "v-tabs",
    })
