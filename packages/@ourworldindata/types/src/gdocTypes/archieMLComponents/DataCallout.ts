import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockDataCallout = {
    type: "data-callout"
    value: {
        url?: string
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockDataCallout = {
    type: "data-callout"
    url: string
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
