import { Span } from "../Spans.js"
import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

export type RawBlockHeadingValue = {
    text?: string
    level?: string
}
export type RawBlockHeading = {
    type: "heading"
    value: RawBlockHeadingValue | ArchieMLUnexpectedNonObjectValue
}

/**
 * A section heading. Authored via Google Docs text styles (Heading 1,
 * Heading 2, Heading 3) — the level is derived from the docs style. Start
 * sections with h1; nest with h2, then h3.
 *
 * @owid-component heading
 * @owid-title Heading
 */
export type EnrichedBlockHeading = {
    type: "heading"
    text: Span[]
    supertitle?: Span[]
    level: number
} & EnrichedBlockWithParseErrors
