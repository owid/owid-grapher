import { SpanSimpleText } from "../Spans.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

/**
 * A plain-text fragment without any inline formatting (no bold, italics,
 * or links). Used as an internal primitive for blocks whose text must be
 * flat — for example, inside `{.code}` — and is not authored directly in
 * ArchieML.
 *
 * @owid-component simple-text
 * @owid-title Simple Text
 */
export type EnrichedBlockSimpleText = {
    type: "simple-text"
    value: SpanSimpleText
} & EnrichedBlockWithParseErrors
