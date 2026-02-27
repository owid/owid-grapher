import type { OwidRawGdocBlock } from "../ArchieMlComponents.js"
import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export type RawBlockKeyIndicatorValue = {
    datapageUrl?: string
    title?: string
    text?: RawBlockText[]
    source?: string
}

export type RawBlockKeyIndicator = {
    type: "key-indicator"
    value: RawBlockKeyIndicatorValue | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockKeyIndicator = {
    type: "key-indicator"
    datapageUrl: string
    title: string
    text: EnrichedBlockText[]
    source?: string
} & EnrichedBlockWithParseErrors

export type RawBlockKeyIndicatorCollection = {
    type: "key-indicator-collection"
    value: {
        heading?: string
        subtitle?: string
        button?: {
            text?: string
            url?: string
        }
        indicators: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockKeyIndicatorCollection = {
    type: "key-indicator-collection"
    heading?: string
    subtitle?: string
    button?: {
        text: string
        url: string
    }
    blocks: EnrichedBlockKeyIndicator[]
} & EnrichedBlockWithParseErrors
