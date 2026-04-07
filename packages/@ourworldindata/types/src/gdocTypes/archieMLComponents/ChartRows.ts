import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export type RawChartRowItem = {
    image?: string
    url?: string
    content?: RawBlockText[]
}

export type ChartRowItem = {
    image: string
    url: string
    content: EnrichedBlockText[]
}

export type RawBlockChartRows = {
    type: "chart-rows"
    value: {
        kicker?: string
        title?: string
        source?: string
        rows?: RawChartRowItem[]
    }
}

export type EnrichedBlockChartRows = {
    type: "chart-rows"
    kicker?: string
    title?: string
    source?: string
    rows: ChartRowItem[]
} & EnrichedBlockWithParseErrors
