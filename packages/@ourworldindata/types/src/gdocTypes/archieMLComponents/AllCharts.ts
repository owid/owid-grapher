import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockAllCharts = {
    type: "all-charts"
    value?: Record<string, never>
}

/** @see [AllCharts.md](./AllCharts.md) */
export type EnrichedBlockAllCharts = {
    type: "all-charts"
} & EnrichedBlockWithParseErrors
