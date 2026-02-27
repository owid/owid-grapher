import { EnrichedBlockWithParseErrors } from "./generic.js"
import { RawBlockText } from "./Text.js"

export type RawBlockScript = {
    type: "script"
    value: RawBlockText[]
}

export type EnrichedBlockScript = {
    type: "script"
    lines: string[]
} & EnrichedBlockWithParseErrors
