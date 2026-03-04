import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"
import { EnrichedBlockText } from "./Text.js"

// TODO: This is what lists staring with * are converted to in archieToEnriched
// It might also be what is used inside recirc elements but there it's not a simple
// string IIRC - check this
export type RawBlockList = {
    type: "list"
    value: string[] | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockList = {
    type: "list"
    items: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors
