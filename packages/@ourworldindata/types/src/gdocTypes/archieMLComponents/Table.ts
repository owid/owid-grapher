import type {
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
} from "../ArchieMlComponents.js"
import { Span } from "../Spans.js"
import { EnrichedBlockWithParseErrors } from "./generic.js"

export const tableTemplates = [
    "header-column",
    "header-row",
    "header-column-row",
] as const

export type TableTemplate = (typeof tableTemplates)[number]

export const tableSizes = ["narrow", "wide"] as const

export type TableSize = (typeof tableSizes)[number]

export type RawBlockTable = {
    type: "table"
    value?: {
        template?: TableTemplate
        size?: TableSize
        rows?: RawBlockTableRow[]
        caption?: string
    }
}

export interface RawBlockTableRow {
    type: "table-row"
    value: {
        cells?: RawBlockTableCell[]
    }
}

export interface RawBlockTableCell {
    type: "table-cell"
    value?: OwidRawGdocBlock[]
}

/**
 * A simple table, built from a native Google Docs table wrapped in an
 * archie block. Three header templates are supported.
 *
 * ## When to use
 * - Small-to-medium tables that are best authored directly in Google Docs.
 *
 * ## When NOT to use
 * - For very large or complex tables, wrap a Google Docs table inside an
 *   `{.expander}` so it can be hidden by default.
 *
 * ## Variations
 * - `template`: `header-column` | `header-row` | `header-column-row`
 * - `size`: `narrow` | `wide` — defaults to spanning 6 columns; use `wide`
 *   for full width.
 * - `caption` is optional and supports rich text (including links).
 *
 * Note: the actual `<table>` markup is authored directly in Google Docs; the
 * block wrapper only configures the template, size, and caption.
 *
 * A `{.table}` block in archie only configures the wrapper (template, size,
 * caption); the actual rows come from a native Google Docs table placed
 * between the opening `{.table}` and closing `{}` inside the Gdoc. Because the
 * rows can't be expressed in pure ArchieML text, this component has no
 * standalone `@example`.
 *
 * @owid-component table
 * @owid-title Table
 */
export type EnrichedBlockTable = {
    type: "table"
    // template is optional because it can be inferred from the table size
    template: TableTemplate
    size: TableSize
    rows: EnrichedBlockTableRow[]
    caption?: Span[]
} & EnrichedBlockWithParseErrors

export interface EnrichedBlockTableRow {
    type: "table-row"
    cells: EnrichedBlockTableCell[]
}

export interface EnrichedBlockTableCell {
    type: "table-cell"
    content: OwidEnrichedGdocBlock[]
}
