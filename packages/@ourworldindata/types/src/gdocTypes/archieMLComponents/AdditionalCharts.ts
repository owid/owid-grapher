import { Span } from "../Spans.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockAdditionalCharts = {
    type: "additional-charts"
    value: {
        list?: string[]
    }
}

export type EnrichedBlockAdditionalCharts = {
    type: "additional-charts"
    items: Span[][]
} & EnrichedBlockWithParseErrors
