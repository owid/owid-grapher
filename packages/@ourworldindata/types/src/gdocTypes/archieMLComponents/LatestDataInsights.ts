import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockLatestDataInsights = {
    type: "latest-data-insights"
    value: Record<string, never>
}

/**
 * A grey section on the homepage listing the most recent published data
 * insights. Automatically hidden if fewer than 4 published data
 * insights exist. No props.
 *
 * ## When to use
 * - On the homepage (`type: homepage`).
 *
 * ## When NOT to use
 * - Elsewhere — data insights are surfaced via their own page and the
 *   homepage carousel.
 *
 * @owid-component latest-data-insights
 * @owid-title Latest Data Insights
 * @example Basic
 * ```archie
 * {.latest-data-insights}
 * {}
 * ```
 */
export type EnrichedBlockLatestDataInsights = {
    type: "latest-data-insights"
} & EnrichedBlockWithParseErrors
