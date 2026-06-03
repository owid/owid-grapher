import { Span } from "../Spans.js"
import { BlockSize, EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockNarrativeChartValue = {
    name?: string
    height?: string
    // TODO: position is used as a classname apparently? Should be renamed or split
    position?: string
    size?: BlockSize
    caption?: string
}

export type RawBlockNarrativeChart = {
    type: "narrative-chart"
    value: RawBlockNarrativeChartValue | string
}

export type EnrichedBlockNarrativeChart = {
    type: "narrative-chart"
    name: string
    height?: string
    size: BlockSize
    caption?: Span[]
    // TOC anchor id (e.g. "chart-population-by-age"), assigned by
    // generateSidebarToc and rendered as the chart wrapper's `id`
    anchorId?: string
} & EnrichedBlockWithParseErrors
