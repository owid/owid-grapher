import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockGraySection = {
    type: "gray-section"
    value: OwidRawGdocBlock[]
}

/**
 * A full-width section with a light-gray background. Wraps any other
 * ArchieML content to visually set it apart from the surrounding prose.
 *
 * ## When to use
 * - To group a small set of related blocks into a visually distinct section
 *   (e.g. a methods callout that includes a heading and a few paragraphs).
 *
 * ## When NOT to use
 * - For single-block callouts — use `{.callout}` instead (smaller, inline).
 * - For recirculation modules — use `{.recirc}`.
 *
 * @owid-component gray-section
 * @owid-title Gray Section
 * @example A heading and some content on a gray background
 * ```archie
 * [.+gray-section]
 * A heading within a gray section
 *
 * Some content
 * []
 * ```
 */
export type EnrichedBlockGraySection = {
    type: "gray-section"
    items: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
