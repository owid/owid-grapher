import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"
import { EnrichedBlockText } from "./Text.js"

export type RawBlockNumberedList = {
    type: "numbered-list"
    value: string[] | ArchieMLUnexpectedNonObjectValue
}

/**
 * An ordered (numbered) list. Unlike unordered lists — which are derived
 * from Google Docs bullet formatting — numbered lists must be declared
 * explicitly in ArchieML. Nested lists are not supported.
 *
 * @owid-component numbered-list
 * @owid-title Numbered List
 * @example Basic
 * ```archie
 * [.numbered-list]
 * * Numbered
 * * List
 * []
 * ```
 */
export type EnrichedBlockNumberedList = {
    type: "numbered-list"
    items: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors
