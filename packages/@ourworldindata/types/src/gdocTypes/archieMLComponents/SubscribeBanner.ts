import { BlockAlignment, EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockSubscribeBanner = {
    type: "subscribe-banner"
    value?: {
        align?: string
    }
}

/** @see ./SubscribeBanner.md */
export type EnrichedBlockSubscribeBanner = {
    type: "subscribe-banner"
    align: BlockAlignment
} & EnrichedBlockWithParseErrors
