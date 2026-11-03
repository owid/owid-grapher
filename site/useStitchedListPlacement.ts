import { useQueryParamChoice } from "./useQueryParamChoice.js"

/**
 * Where a stitched page's indicator list renders: "details" (default) puts it
 * in the Data details block behind Show more, in the key-data type; "wysk"
 * puts it in the box's preview, above "What you should know", as before.
 * Override with `?stitchedList=wysk` to compare.
 */
export type StitchedListPlacement = "details" | "wysk"

export const useStitchedListPlacement = (): StitchedListPlacement =>
    useQueryParamChoice("stitchedList", ["details", "wysk"] as const, "details")
