import { useQueryParamChoice } from "./useQueryParamChoice.js"

const SWITCHER_VARIANTS = ["dropdown-inside", "dropdown"] as const

/**
 * Where a data page with a pane per indicator puts its indicator switcher:
 * - "dropdown-inside": a "Switch indicator" button beside the pane's title
 * - "dropdown": a menu above the box, which names the indicator in place of
 *   the pane's title
 */
export type SwitcherVariant = (typeof SWITCHER_VARIANTS)[number]

/** `?switcher=dropdown` shows the other design while the two are compared. */
export const useSwitcherVariant = (): SwitcherVariant =>
    useQueryParamChoice("switcher", SWITCHER_VARIANTS, "dropdown-inside")
