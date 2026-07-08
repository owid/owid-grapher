import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockCta = {
    type: "cta"
    value: {
        text?: string
        url?: string
    }
}

/** @see ./Cta.md */
export type EnrichedBlockCta = {
    type: "cta"
    text: string
    url: string
} & EnrichedBlockWithParseErrors
