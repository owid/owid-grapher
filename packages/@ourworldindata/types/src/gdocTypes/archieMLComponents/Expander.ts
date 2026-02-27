import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockExpander = {
    type: "expander"
    value: {
        heading?: string
        title?: string
        subtitle?: string
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockExpander = {
    type: "expander"
    heading?: string
    title: string
    subtitle?: string
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
