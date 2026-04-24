import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export type RawBlockBlockquote = {
    type: "blockquote"
    value: {
        text?: RawBlockText[]
        citation?: string
    }
}

/**
 * A way to cite an excerpt from another source. Renders as an indented,
 * quoted passage with an optional attribution line.
 *
 * ## When to use
 * - Quoting a longer passage from a person, paper, or publication.
 *
 * ## When NOT to use
 * - Prefer `{.pull-quote}` when you want to re-emphasize a phrase from the
 *   article itself (styled as a centered, italicized h1).
 *
 * ## Variations
 * - `citation` can be plain text (e.g. a person's name) or a URL starting
 *   with `http`, in which case it renders as a link.
 *
 * @owid-component blockquote
 * @owid-title Blockquote
 * @example Plain-text citation
 * ```archie
 * {.blockquote}
 * citation: Bastian Herre
 * [.+text]
 * Measuring the state of democracy across the world helps us understand the extent to which people have political rights and freedoms.
 * []
 * {}
 * ```
 */
export type EnrichedBlockBlockquote = {
    type: "blockquote"
    text: EnrichedBlockText[]
    citation?: string
} & EnrichedBlockWithParseErrors
