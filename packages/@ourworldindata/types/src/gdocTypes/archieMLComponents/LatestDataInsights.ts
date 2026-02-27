import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockLatestDataInsights = {
    type: "latest-data-insights"
    value: Record<string, never>
}

export type EnrichedBlockLatestDataInsights = {
    type: "latest-data-insights"
} & EnrichedBlockWithParseErrors
