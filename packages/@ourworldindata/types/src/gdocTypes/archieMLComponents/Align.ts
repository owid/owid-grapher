import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { HorizontalAlign } from "../../domainTypes/Layout.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockAlign = {
    type: "align"
    value: {
        alignment: string
        content: OwidRawGdocBlock[]
    }
}

/**
 * Aligns a block of text horizontally. Affects text only — images, charts,
 * and other visual blocks are not re-aligned by this wrapper.
 *
 * ## When to use
 * - To center or right-align a heading or short paragraph inline with prose.
 *
 * ## When NOT to use
 * - To align images, charts, or other visual blocks — those blocks have their
 *   own size/visibility controls.
 * - For full-width styled sections; prefer `{.gray-section}`.
 *
 * ## Variations
 * - `alignment`: `left` | `center` | `right`
 *
 * @owid-component align
 * @owid-title Align
 * @example Centered text
 * ```archie
 * {.align}
 * alignment: center
 * [.+content]
 * Centered text
 *
 * A centered heading
 * []
 * {}
 * ```
 */
export type EnrichedBlockAlign = {
    type: "align"
    alignment: HorizontalAlign
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
