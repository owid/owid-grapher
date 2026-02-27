import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export const exploreDataSectionAlignments = ["left", "center"] as const

export type ExploreDataSectionAlignment =
    (typeof exploreDataSectionAlignments)[number]

export type RawBlockExploreDataSection = {
    type: "explore-data-section"
    value: {
        title?: string
        align?: string
        content: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockExploreDataSection = {
    type: "explore-data-section"
    title?: string
    align: ExploreDataSectionAlignment
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
