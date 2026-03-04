import { SpanSimpleText } from "../Spans.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type EnrichedBlockSimpleText = {
    type: "simple-text"
    value: SpanSimpleText
} & EnrichedBlockWithParseErrors
