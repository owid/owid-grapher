import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockHorizontalRule = {
    type: "horizontal-rule"
    value?: Record<string, never> // dummy value to unify block shapes
}

/**
 * A thin, light-gray line that divides two large sections of an article.
 * Typically precedes an h1 heading.
 *
 * ## When to use
 * - To separate major sections of an article, especially before a new h1.
 *
 * ## When NOT to use
 * - Between paragraphs within the same section — use whitespace / headings.
 *
 * Note: Google Docs' built-in "Horizontal line" (Insert menu) also renders
 * as this block.
 *
 * @owid-component horizontal-rule
 * @owid-title Horizontal Rule
 * @example Basic
 * ```archie
 * {.horizontal-rule}
 * {}
 * ```
 */
export type EnrichedBlockHorizontalRule = {
    type: "horizontal-rule"
    value?: Record<string, never> // dummy value to unify block shapes
} & EnrichedBlockWithParseErrors
