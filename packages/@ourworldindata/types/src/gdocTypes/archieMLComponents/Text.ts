import { Span } from "../Spans.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockText = {
    type: "text"
    value: string
}

/**
 * A paragraph of prose. This is the default block generated from plain
 * text in a Google Doc — authors don't usually write it explicitly.
 * Text spans support Google Docs formatting (bold, italic, links,
 * superscript, subscript), refs, and details-on-demand links.
 *
 * @owid-component text
 * @owid-title Text
 */
export type EnrichedBlockText = {
    type: "text"
    value: Span[]
} & EnrichedBlockWithParseErrors
