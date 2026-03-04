import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockGraySection = {
    type: "gray-section"
    value: OwidRawGdocBlock[]
}

export type EnrichedBlockGraySection = {
    type: "gray-section"
    items: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
