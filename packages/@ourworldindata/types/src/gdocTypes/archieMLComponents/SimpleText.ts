import { SpanSimpleText } from "../Spans.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

/** @see ./SimpleText.md */
export type EnrichedBlockSimpleText = {
    type: "simple-text"
    value: SpanSimpleText
} & EnrichedBlockWithParseErrors
