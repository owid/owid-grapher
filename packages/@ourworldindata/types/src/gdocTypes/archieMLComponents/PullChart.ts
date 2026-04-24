import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export const pullChartAlignments = ["left-center", "right-center"] as const
export type PullChartAlignment = (typeof pullChartAlignments)[number]

export type RawBlockPullChart = {
    type: "pull-chart"
    value: {
        align?: string
        image?: string
        url?: string
        content?: RawBlockText[]
    }
}

/**
 * A chart pull — the chart equivalent of a pull quote. Shows a small chart
 * thumbnail alongside descriptive text, letting you reference a chart inline
 * without giving it full width.
 *
 * ## When to use
 * - Referencing a chart to support a point without interrupting the reading
 *   flow with a full-width interactive chart.
 * - The chart is ancillary and readers can click through for the full view.
 *
 * ## When NOT to use
 * - The chart is the main subject of the paragraph — use `{.chart}` or
 *   `{.narrative-chart}` for a full-width interactive.
 * - You want a list of several charts — use `{.chart-rows}`.
 *
 * ## Variations
 * - `align`: `left-center` (default) | `right-center` — which side the
 *   thumbnail sits on.
 *
 * @owid-component pull-chart
 * @owid-title Pull Chart
 * @example Left-aligned pull chart
 * ```archie
 * {.pull-chart}
 * align: left-center
 * image: hpv-vaccines-thumbnail.png
 * url: https://ourworldindata.org/grapher/population
 * [.+content]
 * Global population has grown rapidly over the past two centuries. Click through to explore the data by country.
 * []
 * {}
 * ```
 */
export type EnrichedBlockPullChart = {
    type: "pull-chart"
    align?: PullChartAlignment
    image: string
    url: string
    content: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors
