import type { OwidRawGdocBlock } from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText } from "./Text.js"

export const pullquoteAlignments = [
    "left",
    "left-center",
    "right-center",
    "right",
] as const

export type PullQuoteAlignment = (typeof pullquoteAlignments)[number]

export type RawBlockPullQuote = {
    type: "pull-quote"
    value: {
        align?: string
        quote?: string
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockPullQuote = {
    type: "pull-quote"
    content: EnrichedBlockText[]
    align: PullQuoteAlignment
    quote: string
} & EnrichedBlockWithParseErrors
