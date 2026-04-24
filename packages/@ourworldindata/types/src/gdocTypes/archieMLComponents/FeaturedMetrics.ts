import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockFeaturedMetrics = {
    type: "featured-metrics"
    value: Record<string, never>
}

/**
 * Displays featured metrics related to the current topic. The document
 * must have a topic tag. No props.
 *
 * ## When to use
 * - On linear topic pages to surface the headline metrics for the
 *   topic.
 *
 * ## When NOT to use
 * - On documents without a topic tag.
 *
 * @owid-component featured-metrics
 * @owid-title Featured Metrics
 * @example Basic
 * ```archie
 * {.featured-metrics}
 * {}
 * ```
 */
export type EnrichedBlockFeaturedMetrics = {
    type: "featured-metrics"
} & EnrichedBlockWithParseErrors
