import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockKeyInsightsSlide = {
    title?: string
    filename?: string
    url?: string
    narrativeChartName?: string
    content?: OwidRawGdocBlock[]
}

export type RawBlockKeyInsights = {
    type: "key-insights"
    value: {
        heading?: string
        insights?: RawBlockKeyInsightsSlide[]
    }
}

export type EnrichedBlockKeyInsightsSlide = {
    type: "key-insight-slide"
    title: string
    filename?: string
    url?: string
    narrativeChartName?: string
    content: OwidEnrichedGdocBlock[]
}

/**
 * A slide carousel of "key insights" — the core takeaways of a topic
 * page. Each slide has a title, optional visual (chart, narrative chart,
 * or image), and a body of rich content.
 *
 * ## When to use
 * - Near the top of a topic page, summarising the most important
 *   findings on the topic.
 *
 * ## When NOT to use
 * - On articles or data insights.
 *
 * ## Variations
 * - Each slide's visual is either a `url` (grapher/explorer), a
 *   `narrativeChartName`, or a `filename` (image). Use at most one.
 *
 * @owid-component key-insights
 * @owid-title Key Insights
 * @example With mixed visuals
 * ```archie
 * {.key-insights}
 * heading: Key Insights on Poverty
 * [.insights]
 *
 * title: The age dependency ratio changes by country
 * url: https://ourworldindata.org/grapher/age-dependency-breakdown
 * [.+content]
 * All sorts of content can go in here.
 * []
 *
 * title: This slide uses an image
 * filename: default-featured-image.png
 * [.+content]
 * Blah blah.
 * []
 *
 * title: This slide uses a narrative chart
 * narrativeChartName: global-life-expectancy-has-doubled
 * [.+content]
 * Blah blah blah.
 * []
 *
 * []
 * {}
 * ```
 */
export type EnrichedBlockKeyInsights = {
    type: "key-insights"
    heading: string
    insights: EnrichedBlockKeyInsightsSlide[]
} & EnrichedBlockWithParseErrors
