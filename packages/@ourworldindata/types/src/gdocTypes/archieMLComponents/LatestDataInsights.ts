import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockLatestDataInsights = {
    type: "latest-data-insights"
    value: Record<string, never>
}

/** @see ./LatestDataInsights.md */
export type EnrichedBlockLatestDataInsights = {
    type: "latest-data-insights"
} & EnrichedBlockWithParseErrors
