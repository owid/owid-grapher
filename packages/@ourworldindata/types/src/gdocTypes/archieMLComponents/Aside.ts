import { Span } from "../Spans.js"
import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

export type BlockPositionChoice = "right" | "left"

export type RawBlockAsideValue = {
    position?: string // use BlockPositionChoice in matching Enriched block
    caption?: string
}

export type RawBlockAside = {
    type: "aside"
    value: RawBlockAsideValue | ArchieMLUnexpectedNonObjectValue
}

/**
 * A plaintext caption placed to the right or left of a body paragraph. Useful
 * for short side notes that shouldn't interrupt the main reading flow.
 *
 * ## When to use
 * - A short aside or annotation next to a paragraph.
 *
 * ## When NOT to use
 * - Prefer `{.callout}` when the note needs a title, icon, or rich text.
 * - Prefer `{.recirc}` when linking to related content.
 *
 * ## Variations
 * - `position`: `right` (default) | `left`
 * - Placement in the document matters: put the aside before a paragraph for
 *   `left`, after the paragraph for `right`.
 * - `caption` is plaintext only.
 *
 * @owid-component aside
 * @owid-title Aside
 * @example Left-positioned aside
 * ```archie
 * {.aside}
 * caption: I will be to the left of the following paragraph.
 * position: left
 * {}
 * ```
 */
export type EnrichedBlockAside = {
    type: "aside"
    position?: BlockPositionChoice
    caption: Span[]
} & EnrichedBlockWithParseErrors
