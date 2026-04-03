import type { OwidRawGdocBlock } from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText } from "./Text.js"

export type RawChartRowItem = {
    image?: string
    url?: string
    content?: OwidRawGdocBlock[]
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
