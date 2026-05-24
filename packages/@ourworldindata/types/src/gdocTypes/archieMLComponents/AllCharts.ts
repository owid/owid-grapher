import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockAllCharts = {
    type: "all-charts"
    value: {
        heading?: string
        top?: { url: string }[]
    }
}

/** @see ./AllCharts.md */
export type EnrichedBlockAllCharts = {
    type: "all-charts"
    heading: string
    top: { url: string }[]
} & EnrichedBlockWithParseErrors
