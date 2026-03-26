import type { OwidRawGdocBlock } from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText } from "./Text.js"

export const smallChartVariants = ["pull-quote", "rows"] as const
export type SmallChartVariant = (typeof smallChartVariants)[number]

export const smallChartAlignments = [
    "left",
    "left-center",
    "right-center",
    "right",
] as const
export type SmallChartAlignment = (typeof smallChartAlignments)[number]

export type RawBlockSmallChartRow = {
    image?: string
    url?: string
    content?: OwidRawGdocBlock[]
}

// Not a top-level block — only used nested inside SmallChart.
// No `type` discriminant needed since these are never dispatched independently.
export type EnrichedBlockSmallChartRow = {
    image: string
    url: string
    content: EnrichedBlockText[] // empty array when content is omitted
}

export type RawBlockSmallChart = {
    type: "small-chart"
    value: {
        variant?: string
        align?: string
        title?: string
        rows?: RawBlockSmallChartRow[]
    }
}

export type EnrichedBlockSmallChart = {
    type: "small-chart"
    variant: SmallChartVariant
    align?: SmallChartAlignment
    title?: string
    rows: EnrichedBlockSmallChartRow[]
} & EnrichedBlockWithParseErrors
