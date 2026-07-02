import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockAllCharts = {
    type: "all-charts"
    value: {
        heading?: string
        top?: { url: string }[]
        // Editorially curated search suggestions shown as clickable chips above
        // the contextual search input. Optional.
        suggested?: string[]
    }
}

export type EnrichedBlockAllCharts = {
    type: "all-charts"
    heading: string
    top: { url: string }[]
    suggested: string[]
} & EnrichedBlockWithParseErrors
