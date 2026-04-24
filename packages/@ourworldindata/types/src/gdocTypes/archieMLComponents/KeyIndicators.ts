import type { OwidRawGdocBlock } from "../ArchieMlComponents.js"
import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"
import { EnrichedBlockText, RawBlockText } from "./Text.js"

export type RawBlockKeyIndicatorValue = {
    datapageUrl?: string
    title?: string
    text?: RawBlockText[]
    source?: string
}

export type RawBlockKeyIndicator = {
    type: "key-indicator"
    value: RawBlockKeyIndicatorValue | ArchieMLUnexpectedNonObjectValue
}

export type EnrichedBlockKeyIndicator = {
    type: "key-indicator"
    datapageUrl: string
    title: string
    text: EnrichedBlockText[]
    source?: string
} & EnrichedBlockWithParseErrors

export type RawBlockKeyIndicatorCollection = {
    type: "key-indicator-collection"
    value: {
        heading?: string
        subtitle?: string
        button?: {
            text?: string
            url?: string
        }
        indicators: OwidRawGdocBlock[]
    }
}

/**
 * An accordion collection of "key indicators" — datapage-linked charts
 * with a title, text summary, and source. Shown on the homepage.
 *
 * ## When to use
 * - On the homepage to surface key indicator datapages (child
 *   mortality, extreme poverty, etc.).
 *
 * ## When NOT to use
 * - Elsewhere — use `{.chart}` or `{.pull-chart}` to highlight a single
 *   chart in an article.
 *
 * ## Variations
 * - Each `{.key-indicator}` inside `[.+indicators]` needs a
 *   `datapageUrl` that links to a grapher backed by a datapage.
 *
 * @owid-component key-indicator-collection
 * @owid-title Key Indicator Collection
 * @example Two indicators
 * ```archie
 * {.key-indicator-collection}
 *
 * [.+indicators]
 *
 * {.key-indicator}
 * datapageUrl: https://ourworldindata.org/grapher/child-mortality?time=earliest..latest
 * title: What share of children died before their fifth birthday?
 * source: Long-run estimates combining data from UN & Gapminder
 * [.+text]
 * What could be more tragic than the death of a young child?
 * []
 * {}
 *
 * {.key-indicator}
 * datapageUrl: https://ourworldindata.org/grapher/share-of-population-in-extreme-poverty
 * title: What share of the population is living in extreme poverty?
 * [.+text]
 * The UN sets the 'International Poverty Line' as a worldwide comparable definition.
 * []
 * {}
 *
 * []
 *
 * {}
 * ```
 */
export type EnrichedBlockKeyIndicatorCollection = {
    type: "key-indicator-collection"
    heading?: string
    subtitle?: string
    button?: {
        text: string
        url: string
    }
    blocks: EnrichedBlockKeyIndicator[]
} & EnrichedBlockWithParseErrors
