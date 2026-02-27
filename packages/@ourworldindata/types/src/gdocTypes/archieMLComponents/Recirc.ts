import {
    BlockAlignment,
    EnrichedBlockWithParseErrors,
    EnrichedHybridLink,
    RawHybridLink,
} from "./generic.js"

export type RawBlockRecirc = {
    type: "recirc"
    value?: {
        title?: string
        align?: string
        links?: RawHybridLink[]
    }
}

export type EnrichedBlockRecirc = {
    type: "recirc"
    title: string
    align?: BlockAlignment
    links: EnrichedHybridLink[]
} & EnrichedBlockWithParseErrors
