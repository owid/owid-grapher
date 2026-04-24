import type { OwidRawGdocBlock } from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockText } from "./Text.js"

export const pullquoteAlignments = [
    "left",
    "left-center",
    "right-center",
    "right",
] as const

export type PullQuoteAlignment = (typeof pullquoteAlignments)[number]

export type RawBlockPullQuote = {
    type: "pull-quote"
    value: {
        align?: string
        quote?: string
        content?: OwidRawGdocBlock[]
    }
}

/**
 * A centered, italicized h1 used to re-emphasize a phrase from the surrounding
 * body text. The quote is visually set alongside a paragraph of `content`.
 *
 * ## When to use
 * - Highlight a key phrase within an article to draw the reader's eye.
 *
 * ## When NOT to use
 * - Prefer `{.blockquote}` when citing an external source — pull quotes are
 *   meant to re-emphasize something from the article itself.
 *
 * ## Variations
 * - `align`: `left` | `left-center` | `right-center` | `right`
 *
 * @owid-component pull-quote
 * @owid-title Pull Quote
 * @example Left-center aligned
 * ```archie
 * {.pull-quote}
 * quote: I am a left-center aligned quote that should span multiple lines.
 * align: left-center
 * [.+content]
 * Suspendisse commodo turpis nunc, sit amet cursus odio porttitor scelerisque.
 * []
 * {}
 * ```
 */
export type EnrichedBlockPullQuote = {
    type: "pull-quote"
    content: EnrichedBlockText[]
    align: PullQuoteAlignment
    quote: string
} & EnrichedBlockWithParseErrors
