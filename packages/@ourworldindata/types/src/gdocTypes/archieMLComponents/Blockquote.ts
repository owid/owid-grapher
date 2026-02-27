import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export type RawBlockBlockquote = {
    type: "blockquote"
    value: {
        text?: RawBlockText[]
        citation?: string
    }
}

export type EnrichedBlockBlockquote = {
    type: "blockquote"
    text: EnrichedBlockText[]
    citation?: string
} & EnrichedBlockWithParseErrors
