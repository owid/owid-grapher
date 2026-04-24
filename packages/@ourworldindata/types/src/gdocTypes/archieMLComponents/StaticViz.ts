import { BlockSize, EnrichedBlockWithParseErrors } from "./generic.js"
import { Span } from "../Spans.js"

export type RawBlockStaticViz = {
    type: "static-viz"
    value: {
        name?: string
        size?: BlockSize
        hasOutline?: string
        caption?: string
    }
}

/**
 * An "enhanced image" block for flagship data visualizations. Registered
 * in the admin with a description and a source-data link; renders as a
 * regular image but a "Download" action opens a modal exposing the
 * additional metadata.
 *
 * ## When to use
 * - Flagship / bespoke data visualizations where readers should be able
 *   to inspect or download the underlying data.
 *
 * ## When NOT to use
 * - Regular photos, screenshots, or illustrations — use `{.image}`.
 * - Interactive charts — use `{.chart}` or `{.narrative-chart}`.
 *
 * ## Variations
 * - `size`: `narrow` | `wide` (default) | `widest`
 * - `hasOutline`: `true` | `false`
 *
 * @owid-component static-viz
 * @owid-title Static Viz
 * @example Basic
 * ```archie
 * {.static-viz}
 * name: grapher-static-viz-demo
 * {}
 * ```
 */
export type EnrichedBlockStaticViz = {
    type: "static-viz"
    name: string
    size: BlockSize
    hasOutline: boolean
    caption?: Span[]
} & EnrichedBlockWithParseErrors
