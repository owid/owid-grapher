import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockSimpleText } from "./SimpleText.js"
import { RawBlockText } from "./Text.js"

export type RawBlockCode = {
    type: "code"
    value: RawBlockText[]
}

export type EnrichedBlockCode = {
    type: "code"
    text: EnrichedBlockSimpleText[]
} & EnrichedBlockWithParseErrors
