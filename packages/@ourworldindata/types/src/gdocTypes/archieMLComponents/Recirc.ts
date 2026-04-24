import {
    BlockAlignment,
    EnrichedBlockWithParseErrors,
    EnrichedHybridLink,
    RawHybridLink,
} from "./generic.js"

export type RawBlockRecirc = {
    type: "recirc"
    value?: {
        title?: string
        align?: string
        links?: RawHybridLink[]
    }
}

/**
 * A small gray block, usually placed to the side of body text, that links
 * readers to related content (articles, graphers, explorers, MDIMs, or
 * external URLs).
 *
 * ## When to use
 * - Surfacing related reading alongside an article.
 * - Linking to charts, explorers, MDIMs, or external sources without
 *   interrupting the main flow.
 *
 * ## When NOT to use
 * - Prefer `{.prominent-link}` for a single, more visually prominent link
 *   tile.
 * - Prefer `{.resource-panel}` on linear topic pages when you want a sticky
 *   sidebar CTA.
 *
 * ## Variations
 * - `align`: `left` | `center` | `right`
 * - Each link can use the linked document's own title/subtitle, or override
 *   them via `title` and `subtitle`.
 *
 * @owid-component recirc
 * @owid-title Recirc
 * @example Centered recirc with mixed links
 * ```archie
 * {.recirc}
 * title: More Articles on Mammals
 * align: center
 *
 * [.links]
 * url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk
 *
 * url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk
 * title: Example of a custom title
 * subtitle: Suscipit provident ratione omnis earum.
 * []
 * {}
 * ```
 */
export type EnrichedBlockRecirc = {
    type: "recirc"
    title: string
    align?: BlockAlignment
    links: EnrichedHybridLink[]
} & EnrichedBlockWithParseErrors
