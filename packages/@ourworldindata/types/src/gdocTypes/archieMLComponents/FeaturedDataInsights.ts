import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockFeaturedDataInsights = {
    type: "featured-data-insights"
    value: Record<string, never>
}

/**
 * Displays data insights related to the current topic. The document
 * must have a topic tag so the block knows what to filter by. No props.
 *
 * ## When to use
 * - On linear topic pages (and similar topic-scoped pages) to surface
 *   related data insights.
 *
 * ## When NOT to use
 * - On documents without a topic tag — the block has nothing to query.
 *
 * @owid-component featured-data-insights
 * @owid-title Featured Data Insights
 * @example Basic
 * ```archie
 * {.featured-data-insights}
 * {}
 * ```
 */
export type EnrichedBlockFeaturedDataInsights = {
    type: "featured-data-insights"
} & EnrichedBlockWithParseErrors
