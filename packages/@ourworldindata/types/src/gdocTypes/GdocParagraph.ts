import { Span } from "./Spans.js"

export interface GdocListInfo {
    listId: string
    nestingLevel: number
    glyphType?: string
}

export interface GdocTableContext {
    tableIndex: number
    rowIndex: number
    columnIndex: number
}

export interface GdocParagraphBase {
    index: number
    startIndex?: number
    endIndex?: number
    paragraphStyle?: string
    list?: GdocListInfo
    tableContext?: GdocTableContext
    inlineObjectIds?: string[]
    footnoteReferenceIds?: string[]
    hasEquation?: boolean
}

export interface GdocTextParagraph extends GdocParagraphBase {
    type: "paragraph"
    text: string
    spans: Span[]
}

export interface GdocHorizontalRuleParagraph extends GdocParagraphBase {
    type: "horizontal-rule"
}

export type GdocParagraph = GdocTextParagraph | GdocHorizontalRuleParagraph
