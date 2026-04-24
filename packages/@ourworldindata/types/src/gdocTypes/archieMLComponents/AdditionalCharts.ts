import { Span } from "../Spans.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockAdditionalCharts = {
    type: "additional-charts"
    value: {
        list?: string[]
    }
}

/**
 * A subtle way of linking to multiple charts — each line of body becomes a
 * separate item, typically a link to a chart.
 *
 * ## When to use
 * - Offering readers a small set of related charts without giving them
 *   visual prominence.
 *
 * ## When NOT to use
 * - You want thumbnails or descriptions per item — use `{.chart-rows}`.
 * - You need a full-page listing of all charts on a topic — use
 *   `{.all-charts}` on a topic page.
 *
 * The content between the opening `{.additional-charts}` and closing `{}` must
 * be a bulleted list inside the Google Doc — the gdoc pipeline converts that
 * into the `list` items this block expects. Plain text lines aren't enough;
 * the archie parser needs a true list structure. Because that structure comes
 * from Google Docs layout, not pure ArchieML text, this component has no
 * standalone `@example`.
 *
 * @owid-component additional-charts
 * @owid-title Additional Charts
 */
export type EnrichedBlockAdditionalCharts = {
    type: "additional-charts"
    items: Span[][]
} & EnrichedBlockWithParseErrors
