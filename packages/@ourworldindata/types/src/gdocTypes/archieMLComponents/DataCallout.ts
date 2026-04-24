import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockDataCallout = {
    type: "data-callout"
    value: {
        url?: string
        content?: OwidRawGdocBlock[]
    }
}

/**
 * A callout whose text interpolates live values from a Grapher chart at the
 * `url`. Use `$latestTime()` and `$latestValue()` to pull the most recent
 * data point. For multi-y charts, pass a column name, e.g.
 * `$latestTime(emissions_total)`.
 *
 * ## When to use
 * - Surfacing a "latest value" summary for a specific entity.
 * - Country profiles where copy should adapt to per-country data.
 *
 * ## When NOT to use
 * - Prefer `{.callout}` for static meta-textual notes not driven by chart
 *   data.
 *
 * ## Variations
 * - Include `time` in the grapher URL to pin to a specific year instead of
 *   the latest point.
 * - If the referenced chart has no data for the current entity, the entire
 *   section won't render — useful for country profiles.
 *
 * @owid-component data-callout
 * @owid-title Data Callout
 * @example Country life expectancy
 * ```archie
 * {.data-callout}
 * url: https://ourworldindata.org/grapher/life-expectancy?country=CAN
 * [.+content]
 * In $latestTime(), Canada's life expectancy was $latestValue()
 * []
 * {}
 * ```
 */
export type EnrichedBlockDataCallout = {
    type: "data-callout"
    url: string
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type RawBlockDataCalloutGroup = {
    type: "data-callout-group"
    value: {
        content?: OwidRawGdocBlock[]
    }
}

export type EnrichedBlockDataCalloutGroup = {
    type: "data-callout-group"
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors
