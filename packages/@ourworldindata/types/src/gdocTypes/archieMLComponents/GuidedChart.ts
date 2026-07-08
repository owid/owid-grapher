import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockGuidedChart = {
    type: "guided-chart"
    value: OwidRawGdocBlock[]
}

/** @see ./GuidedChart.md */
export type EnrichedBlockGuidedChart = {
    type: "guided-chart"
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
