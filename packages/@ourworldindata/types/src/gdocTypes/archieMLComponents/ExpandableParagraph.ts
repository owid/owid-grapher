import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockExpandableParagraph = {
    type: "expandable-paragraph"
    value: OwidRawGdocBlock[]
}

/**
 * Displays a short preview of content on page load with a "Show more" button
 * that reveals the rest inline. Any Archie block is supported inside.
 *
 * ## When to use
 * - Keeping a long passage compact while still offering the full text inline.
 *
 * ## When NOT to use
 * - Prefer `{.expander}` when you want a distinct boxed affordance for
 *   large tables or technical sections.
 *
 * @owid-component expandable-paragraph
 * @owid-title Expandable Paragraph
 * @example Basic
 * ```archie
 * [.+expandable-paragraph]
 * Any Archie block is supported here
 * []
 * ```
 */
export type EnrichedBlockExpandableParagraph = {
    type: "expandable-paragraph"
    items: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
