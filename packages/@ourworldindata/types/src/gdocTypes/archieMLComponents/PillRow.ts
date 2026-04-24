import { EnrichedBlockWithParseErrors } from "./generic.js"

export type RawBlockPillRow = {
    type: "pill-row"
    value: {
        title?: string
        pills?: {
            text?: string
            url?: string
        }[]
    }
}

/**
 * A small grey bar of pill-shaped links, usually with a heading to the
 * left. Used on the homepage below the nav and on author pages to list
 * topic chips.
 *
 * ## When to use
 * - On the homepage, below the nav, to feature a short list of
 *   articles.
 * - On author pages, to list the topics the author writes about.
 *
 * ## When NOT to use
 * - As a general-purpose inline list — use `{.cta}`, `{.recirc}`, or
 *   normal links instead.
 *
 * ## Variations
 * - Pill `text` is optional when the URL is a gdoc link — the gdoc
 *   title is used.
 *
 * @owid-component pill-row
 * @owid-title Pill Row
 * @example Basic
 * ```archie
 * {.pill-row}
 * title: Popular Articles
 * [.pills]
 * text: Optimism & Pessimism
 * url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit
 *
 * text: Life Expectancy
 * url: https://ourworldindata.org/grapher/life-expectancy
 * []
 * {}
 * ```
 */
export type EnrichedBlockPillRow = {
    type: "pill-row"
    title: string
    pills: {
        // optional because when linking to a gdoc we can use that title
        text?: string
        url: string
    }[]
} & EnrichedBlockWithParseErrors
