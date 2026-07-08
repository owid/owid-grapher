import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockFeaturedMetrics = {
    type: "featured-metrics"
    value: Record<string, never>
}

/** @see ./FeaturedMetrics.md */
export type EnrichedBlockFeaturedMetrics = {
    type: "featured-metrics"
} & EnrichedBlockWithParseErrors
