import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockFeaturedMetrics = {
    type: "featured-metrics"
    value: Record<string, never>
}

export type EnrichedBlockFeaturedMetrics = {
    type: "featured-metrics"
} & EnrichedBlockWithParseErrors
