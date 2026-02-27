import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { HorizontalAlign } from "../../domainTypes/Layout.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockAlign = {
    type: "align"
    value: {
        alignment: string
        content: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockAlign = {
    type: "align"
    alignment: HorizontalAlign
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
