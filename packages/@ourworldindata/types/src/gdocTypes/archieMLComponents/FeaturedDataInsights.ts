import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockFeaturedDataInsights = {
    type: "featured-data-insights"
    value: Record<string, never>
}

export type EnrichedBlockFeaturedDataInsights = {
    type: "featured-data-insights"
} & EnrichedBlockWithParseErrors
