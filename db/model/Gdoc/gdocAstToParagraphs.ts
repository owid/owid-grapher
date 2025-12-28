import { type docs_v1 } from "@googleapis/docs"
import {
    type GdocParagraph,
    type GdocListInfo,
    type GdocTableContext,
    type Span,
    type SpanLink,
    type SpanSimpleText,
} from "@ourworldindata/types"

type MergedParagraphElement = docs_v1.Schema$ParagraphElement & {
    __mergedSpan?: Span
}

interface ParagraphCollectorState {
    paragraphs: GdocParagraph[]
    nextParagraphIndex: number
    nextTableIndex: number
}

interface ParagraphContext {
    tableContext?: GdocTableContext
}

const ORDERED_GLYPH_TYPES = new Set([
    "DECIMAL",
    "UPPER_ROMAN",
    "LOWER_ROMAN",
    "UPPER_ALPHA",
    "LOWER_ALPHA",
])

function applyTextStyles(
    textRun: docs_v1.Schema$TextRun,
    baseSpan: SpanSimpleText
): Span {
    let styledSpan: Span = baseSpan
    const textStyle = textRun.textStyle

    if (!textStyle) {
        return styledSpan
    }

    if (textStyle.italic) {
        styledSpan = { spanType: "span-italic", children: [styledSpan] }
    }
    if (textStyle.bold) {
        styledSpan = { spanType: "span-bold", children: [styledSpan] }
    }
    if (textStyle.baselineOffset === "SUPERSCRIPT") {
        styledSpan = { spanType: "span-superscript", children: [styledSpan] }
    }
    if (textStyle.baselineOffset === "SUBSCRIPT") {
        styledSpan = { spanType: "span-subscript", children: [styledSpan] }
    }

    return styledSpan
}

function mergeAdjacentLinkedElements(
    elements: docs_v1.Schema$ParagraphElement[]
): MergedParagraphElement[] {
    if (!elements || elements.length === 0) {
        return []
    }

    const merged: MergedParagraphElement[] = []
    let i = 0

    while (i < elements.length) {
        const current = elements[i]
        const currentUrl = current.textRun?.textStyle?.link?.url

        if (!currentUrl) {
            merged.push(current)
            i++
            continue
        }

        let j = i + 1
        while (
            j < elements.length &&
            elements[j].textRun?.textStyle?.link?.url === currentUrl
        ) {
            j++
        }

        const elementsToMerge = elements.slice(i, j)

        if (elementsToMerge.length <= 1) {
            merged.push(current)
            i++
            continue
        }

        const children: Span[] = elementsToMerge
            .map((el) => {
                if (!el.textRun) return null

                const baseSpan: SpanSimpleText = {
                    spanType: "span-simple-text",
                    text: el.textRun.content || "",
                }

                return applyTextStyles(el.textRun, baseSpan)
            })
            .filter((span): span is Span => span !== null)

        const linkSpan: SpanLink = {
            spanType: "span-link",
            url: currentUrl,
            children,
        }

        const syntheticElement: MergedParagraphElement = {
            __mergedSpan: linkSpan,
        }

        merged.push(syntheticElement)
        i = j
    }

    return merged
}

function parseParagraphElement(
    element: MergedParagraphElement
): Span | null {
    if (element.__mergedSpan) {
        return element.__mergedSpan
    }

    const textRun = element.textRun

    if (textRun) {
        const content = textRun.content || ""

        let span: Span = { spanType: "span-simple-text", text: content }

        if (!textRun.textStyle || content === "\n") return span

        if (textRun.textStyle.link?.url) {
            span = {
                spanType: "span-link",
                url: textRun.textStyle.link.url,
                children: [span],
            }
        }

        if (textRun.textStyle.italic) {
            span = { spanType: "span-italic", children: [span] }
        }
        if (textRun.textStyle.bold) {
            span = { spanType: "span-bold", children: [span] }
        }
        if (textRun.textStyle.baselineOffset === "SUPERSCRIPT") {
            span = { spanType: "span-superscript", children: [span] }
        }
        if (textRun.textStyle.baselineOffset === "SUBSCRIPT") {
            span = { spanType: "span-subscript", children: [span] }
        }

        return span
    }

    if (element.richLink?.richLinkProperties?.uri) {
        const richLink = element.richLink.richLinkProperties
        const uri = richLink.uri ?? ""
        if (!uri) return null
        return {
            spanType: "span-link",
            url: uri,
            children: [
                {
                    spanType: "span-simple-text",
                    text: richLink.title ?? uri,
                },
            ],
        }
    }

    return null
}

function paragraphToText(elements: docs_v1.Schema$ParagraphElement[]): string {
    return elements
        .map((element) => element.textRun?.content ?? "")
        .join("")
}

function getListInfo(
    document: docs_v1.Schema$Document,
    paragraph: docs_v1.Schema$Paragraph
): GdocListInfo | undefined {
    const listId = paragraph.bullet?.listId
    if (!listId) return undefined

    const nestingLevel = paragraph.bullet?.nestingLevel ?? 0
    const list = document.lists?.[listId]
    const nestingLevels = list?.listProperties?.nestingLevels
    const glyphType = nestingLevels?.[nestingLevel]?.glyphType ?? undefined

    return {
        listId,
        nestingLevel,
        glyphType,
    }
}

function paragraphHasHorizontalRule(
    paragraph: docs_v1.Schema$Paragraph
): boolean {
    return (paragraph.elements ?? []).some((el) => Boolean(el.horizontalRule))
}

function paragraphElementsToSpans(
    elements: docs_v1.Schema$ParagraphElement[]
): Span[] {
    const mergedValues = mergeAdjacentLinkedElements(elements)
    return mergedValues
        .map((value) => parseParagraphElement(value))
        .filter((span): span is Span => span !== null)
}

function collectParagraphWarnings(
    paragraph: docs_v1.Schema$Paragraph
): {
    inlineObjectIds: string[]
    footnoteReferenceIds: string[]
    hasEquation: boolean
} {
    const inlineObjectIds: string[] = []
    const footnoteReferenceIds: string[] = []
    let hasEquation = false

    for (const element of paragraph.elements ?? []) {
        const inlineObjectId = element.inlineObjectElement?.inlineObjectId
        if (inlineObjectId) inlineObjectIds.push(inlineObjectId)
        const footnoteId = element.footnoteReference?.footnoteId
        if (footnoteId) footnoteReferenceIds.push(footnoteId)
        if (element.equation) hasEquation = true
    }

    return { inlineObjectIds, footnoteReferenceIds, hasEquation }
}

function addParagraph(
    paragraph: docs_v1.Schema$Paragraph,
    document: docs_v1.Schema$Document,
    state: ParagraphCollectorState,
    context: ParagraphContext,
    startIndex?: number,
    endIndex?: number
): void {
    const elements = paragraph.elements ?? []
    const listInfo = getListInfo(document, paragraph)
    const paragraphStyle = paragraph.paragraphStyle?.namedStyleType ?? undefined
    const warnings = collectParagraphWarnings(paragraph)

    if (paragraphHasHorizontalRule(paragraph)) {
        state.paragraphs.push({
            type: "horizontal-rule",
            index: state.nextParagraphIndex,
            startIndex,
            endIndex,
            paragraphStyle,
            list: listInfo,
            tableContext: context.tableContext,
            inlineObjectIds: warnings.inlineObjectIds,
            footnoteReferenceIds: warnings.footnoteReferenceIds,
            hasEquation: warnings.hasEquation,
        })
        state.nextParagraphIndex += 1
        return
    }

    const text = paragraphToText(elements)
    const spans = paragraphElementsToSpans(elements)

    state.paragraphs.push({
        type: "paragraph",
        index: state.nextParagraphIndex,
        startIndex,
        endIndex,
        paragraphStyle,
        list: listInfo,
        tableContext: context.tableContext,
        inlineObjectIds: warnings.inlineObjectIds,
        footnoteReferenceIds: warnings.footnoteReferenceIds,
        hasEquation: warnings.hasEquation,
        text,
        spans,
    })
    state.nextParagraphIndex += 1
}

function collectParagraphsFromElements(
    elements: docs_v1.Schema$StructuralElement[],
    document: docs_v1.Schema$Document,
    state: ParagraphCollectorState,
    context: ParagraphContext
): void {
    for (const element of elements) {
        if (element.paragraph) {
            addParagraph(
                element.paragraph,
                document,
                state,
                context,
                element.startIndex ?? undefined,
                element.endIndex ?? undefined
            )
        }

        if (element.table?.tableRows) {
            const tableIndex = state.nextTableIndex
            state.nextTableIndex += 1

            for (const [rowIndex, row] of element.table.tableRows.entries()) {
                const cells = row.tableCells ?? []
                for (const [columnIndex, cell] of cells.entries()) {
                    collectParagraphsFromElements(
                        cell.content ?? [],
                        document,
                        state,
                        {
                            tableContext: {
                                tableIndex,
                                rowIndex,
                                columnIndex,
                            },
                        }
                    )
                }
            }
        }

        if (element.tableOfContents?.content) {
            collectParagraphsFromElements(
                element.tableOfContents.content,
                document,
                state,
                context
            )
        }
    }
}

export function documentToParagraphs(
    document: docs_v1.Schema$Document
): GdocParagraph[] {
    const paragraphs: GdocParagraph[] = []
    const state: ParagraphCollectorState = {
        paragraphs,
        nextParagraphIndex: 0,
        nextTableIndex: 0,
    }

    const bodyContent = document.body?.content ?? []
    collectParagraphsFromElements(bodyContent, document, state, {})

    return paragraphs
}

export function isOrderedListGlyph(glyphType: string | undefined): boolean {
    if (!glyphType) return false
    return ORDERED_GLYPH_TYPES.has(glyphType)
}
