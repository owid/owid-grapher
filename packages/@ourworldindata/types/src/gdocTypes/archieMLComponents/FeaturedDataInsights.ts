import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockFeaturedDataInsights = {
    type: "featured-data-insights"
    value: Record<string, never>
}

/** @see ./FeaturedDataInsights.md */
export type EnrichedBlockFeaturedDataInsights = {
    type: "featured-data-insights"
} & EnrichedBlockWithParseErrors
