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

export type RawBlockDataCalloutGroup = {
    type: "data-callout-group"
    value: {
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockDataCalloutGroup = {
    type: "data-callout-group"
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
