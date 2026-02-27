import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockHeading, RawBlockHeading } from "./Heading.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"
import { EnrichedBlockList, RawBlockList } from "./UnorderedList.js"

export type RawBlockCallout = {
    type: "callout"
    value: {
        icon?: "info"
        title?: string
        text: (RawBlockText | RawBlockHeading | RawBlockList)[]
    }
}

export type EnrichedBlockCallout = {
    type: "callout"
    icon?: "info"
    title?: string
    text: (EnrichedBlockText | EnrichedBlockHeading | EnrichedBlockList)[]
} & EnrichedBlockWithParseErrors
