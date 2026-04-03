import type { OwidRawGdocBlock } from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText } from "./Text.js"

export const pullChartAlignments = ["left-center", "right-center"] as const
export type PullChartAlignment = (typeof pullChartAlignments)[number]

export type RawBlockPullChart = {
    type: "pull-chart"
    value: {
        align?: string
        image?: string
        url?: string
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockPullChart = {
    type: "pull-chart"
    align?: PullChartAlignment
    image: string
    url: string
    content: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors
