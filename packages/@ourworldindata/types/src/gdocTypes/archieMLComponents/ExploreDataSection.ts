import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export const exploreDataSectionAlignments = ["left", "center"] as const

export type ExploreDataSectionAlignment =
    (typeof exploreDataSectionAlignments)[number]

export type RawBlockExploreDataSection = {
    type: "explore-data-section"
    value: {
        title?: string
        align?: string
        content: OwidRawGdocBlock[]
    }
}

/**
 * A blue-background section with a chart icon and title, wrapping any
 * Gdoc content. Used on linear topic pages to group the
 * "explore the data" charts/explorers.
 *
 * ## When to use
 * - On linear topic pages to introduce the charts-and-data portion of
 *   the page.
 *
 * ## When NOT to use
 * - On regular topic pages or articles.
 *
 * ## Variations
 * - `title` defaults to "Explore the data" if omitted.
 *
 * @owid-component explore-data-section
 * @owid-title Explore Data Section
 * @example Basic
 * ```archie
 * {.explore-data-section}
 * title: Will default to "Explore the data"
 * [.+content]
 * Content here.
 * []
 * {}
 * ```
 */
export type EnrichedBlockExploreDataSection = {
    type: "explore-data-section"
    title?: string
    align: ExploreDataSectionAlignment
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
