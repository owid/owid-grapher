import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockKeyInsightsSlide = {
    title?: string
    filename?: string
    url?: string
    narrativeChartName?: string
    /**
     * Generic escape hatch for the asset column: an arbitrary block (a bespoke
     * component, for example) rendered instead of the image/chart shorthands
     * above. Authored as `[.+asset]` in ArchieML.
     */
    asset?: OwidRawGdocBlock[]
    content?: OwidRawGdocBlock[]
}

export type RawBlockKeyInsights = {
    type: "key-insights"
    value: {
        heading?: string
        insights?: RawBlockKeyInsightsSlide[]
    }
}

export type EnrichedBlockKeyInsightsSlide = {
    type: "key-insight-slide"
    title: string
    filename?: string
    url?: string
    narrativeChartName?: string
    asset?: OwidEnrichedGdocBlock[]
    content: OwidEnrichedGdocBlock[]
}

/** @see [KeyInsights.md](./KeyInsights.md) */
export type EnrichedBlockKeyInsights = {
    type: "key-insights"
    heading: string
    insights: EnrichedBlockKeyInsightsSlide[]
} & EnrichedBlockWithParseErrors
