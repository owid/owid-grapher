import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockGraySection = {
    type: "gray-section"
    value: OwidRawGdocBlock[]
}

/** @see ./GraySection.md */
export type EnrichedBlockGraySection = {
    type: "gray-section"
    items: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
