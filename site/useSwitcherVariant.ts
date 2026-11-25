import { useQueryParamChoice } from "./useQueryParamChoice.js"

// Feature flag for which indicator-switcher UI to render on multi-indicator
// data pages. Override per-request via the URL query string,
// e.g. `?switcher=h-tabs` or `?switcher=v-tabs`. The two dropdowns follow
// the November design mocks: "dropdown" puts the indicator menu above the
// box, "dropdown-inside" puts a "Switch indicator" button beside the pane
// title inside it.
export type SwitcherVariant =
    | "dropdown"
    | "dropdown-inside"
    | "h-tabs"
    | "v-tabs"
    | "h-pills"

const ALL_SWITCHER_VARIANTS: readonly SwitcherVariant[] = [
    "dropdown",
    "dropdown-inside",
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
