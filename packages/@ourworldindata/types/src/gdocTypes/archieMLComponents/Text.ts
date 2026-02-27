import { Span } from "../Spans.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockText = {
    type: "text"
    value: string
}

export type EnrichedBlockText = {
    type: "text"
    value: Span[]
} & EnrichedBlockWithParseErrors
