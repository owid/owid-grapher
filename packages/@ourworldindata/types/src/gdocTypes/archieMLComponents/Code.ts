import { EnrichedBlockWithParseErrors } from "./generic.js"
import { EnrichedBlockSimpleText } from "./SimpleText.js"
import { RawBlockText } from "./Text.js"

export type RawBlockCode = {
    type: "code"
    value: RawBlockText[]
}

/**
 * A block of text rendered verbatim in a monospace font. Use to include
 * code samples or markup that should not be interpreted.
 *
 * ## When to use
 * - To display snippets of code, config, or markup in the article body.
 *
 * ## When NOT to use
 * - To embed executable HTML — use `{.html}` instead.
 *
 * @owid-component code
 * @owid-title Code
 * @example Verbatim iframe markup
 * ```archie
 * [.+code]
 * <iframe src="https://ourworldindata.org/grapher/children-per-woman-un" loading="lazy"></iframe>
 * []
 * ```
 */
export type EnrichedBlockCode = {
    type: "code"
    text: EnrichedBlockSimpleText[]
} & EnrichedBlockWithParseErrors
