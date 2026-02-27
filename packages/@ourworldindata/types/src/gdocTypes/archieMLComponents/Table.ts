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
