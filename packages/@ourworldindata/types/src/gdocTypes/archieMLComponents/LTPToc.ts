import {
    ArchieMLUnexpectedNonObjectValue,
    EnrichedBlockWithParseErrors,
} from "./generic.js"

export type RawBlockLTPToc = {
    type: "ltp-toc"
    value?:
        | {
              title?: string
          }
        | ArchieMLUnexpectedNonObjectValue
}

/**
 * Specialised table of contents for linear topic pages. Primary section
 * lists page sections; secondary shows cards to all data and writing on
 * the topic.
 *
 * ## When to use
 * - On linear topic pages, near the top, to let readers jump between
 *   sections and to related data/writing.
 *
 * ## When NOT to use
 * - On regular topic pages (use the auto-generated sticky nav).
 * - On articles (use Google Docs headings; TOC is auto-derived).
 *
 * ## Variations
 * - `title` defaults to "Sections" if omitted.
 *
 * @owid-component ltp-toc
 * @owid-title Linear Topic Page Table of Contents
 * @example Default title
 * ```archie
 * {.ltp-toc}
 * {}
 * ```
 * @example Custom title
 * ```archie
 * {.ltp-toc}
 * title: On this page
 * {}
 * ```
 */
export type EnrichedBlockLTPToc = {
    type: "ltp-toc"
    title?: string
} & EnrichedBlockWithParseErrors
