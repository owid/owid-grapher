import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockConditionalSection = {
    type: "conditional-section"
    value: {
        include?: string
        exclude?: string
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockConditionalSection = {
    type: "conditional-section"
    include: string[]
    exclude: string[]
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
