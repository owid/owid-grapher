// Original work from https://github.com/rdmurphy/doc-to-archieml
// Forked and expanded in https://github.com/owid/doc-to-archieml
import * as _ from "lodash-es"
import { type docs_v1 } from "@googleapis/docs"
import {
    Span,
    RawBlockHorizontalRule,
    RawBlockHeading,
    RawBlockTableRow,
    RawBlockTableCell,
    RawBlockText,
    SpanSimpleText,
    SpanLink,
} from "@ourworldindata/utils"
import { spanToHtmlString } from "./gdocUtils.js"
import { OwidRawGdocBlockToArchieMLString } from "./rawToArchie.js"
import { match, P } from "ts-pattern"

type MergedParagraphElement = docs_v1.Schema$ParagraphElement & {
    __mergedSpan?: Span
}

function applyTextStyles(
    textRun: docs_v1.Schema$TextRun,
    baseSpan: SpanSimpleText
): Span {
    let styledSpan: Span = baseSpan
    const textStyle = textRun.textStyle

    if (!textStyle) {
        return styledSpan
    }

    // Apply styles by wrapping the span. The order matters for nesting.
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

        // If the element is not a link, push it and continue
        if (!currentUrl) {
            merged.push(current)
            i++
            continue
        }

        // Look ahead to find all consecutive elements with the same link URL
        let j = i + 1
        while (
            j < elements.length &&
            elements[j].textRun?.textStyle?.link?.url === currentUrl
        ) {
            j++
        }

        const elementsToMerge = elements.slice(i, j)

        // If we only found one element, it doesn't need merging
        if (elementsToMerge.length <= 1) {
            merged.push(current)
            i++
            continue
        }

        // Create the merged span
        const children: Span[] = elementsToMerge
            .map((el) => {
                if (!el.textRun) return null // Should not happen in this logic block

                const baseSpan: SpanSimpleText = {
                    spanType: "span-simple-text",
                    text: el.textRun.content || "",
                }

                return applyTextStyles(el.textRun, baseSpan)
            })
            .filter((span) => span !== null)

        const linkSpan: SpanLink = {
            spanType: "span-link",
            url: currentUrl,
            children,
        }

        // Create the synthetic element to replace the sequence
        const syntheticElement: MergedParagraphElement = {
            __mergedSpan: linkSpan,
        }

        merged.push(syntheticElement)

        // Advance the index past all the elements we just merged
        i = j
    }

    return merged
}

function paragraphToString(
    paragraph: docs_v1.Schema$Paragraph,
    context: { isInList: boolean; isInTable: boolean }
): string {
    let text = ""

    // this is a list
    const needsBullet = !_.isNil(paragraph.bullet)
    if (needsBullet && !context.isInList) {
        context.isInList = true
        text += `\n[.list]\n`
    } else if (!needsBullet && context.isInList) {
        context.isInList = false
        text += `[]\n`
    }

    if (paragraph.elements) {
        // all values in the element
        const values: docs_v1.Schema$ParagraphElement[] = paragraph.elements

        // Merge adjacent elements that share the same link URL to prevent splitting links
        const mergedValues = mergeAdjacentLinkedElements(values)

        let idx = 0

        const taggedText = function (text: string): string {
            if (paragraph.paragraphStyle?.namedStyleType?.includes("HEADING")) {
                const headingLevel =
                    paragraph.paragraphStyle.namedStyleType.replace(
                        "HEADING_",
                        ""
                    )

                const heading: RawBlockHeading = {
                    type: "heading",
                    value: {
                        text: text.trim(),
                        level: headingLevel,
                    },
                }
                return `\n${OwidRawGdocBlockToArchieMLString(heading)}`
            }
            return text
        }
        let elementText = ""
        for (const value of mergedValues) {
            // we only need to add a bullet to the first value, so we check
            const isFirstValue = idx === 0

            // prepend an asterisk if this is a list item
            const prefix = needsBullet && isFirstValue ? "* " : ""

            // concat the text
            const parsedParagraph = parseParagraph(value)
            const fragmentText = match(parsedParagraph)
                .with(
                    { type: P.union("horizontal-rule") },
                    OwidRawGdocBlockToArchieMLString
                )
                .with({ spanType: P.any }, (s) => spanToHtmlString(s))
                .with(P.nullish, () => "")
                .exhaustive()
            elementText += `${prefix}${fragmentText}`
            idx++
        }
        const nextText = taggedText(elementText)
        if (nextText === "{.table}\n") {
            context.isInTable = true
        } else if (context.isInTable && nextText === "{}\n") {
            context.isInTable = false
        }
        text += nextText
    }
    return text
}

function tableToString(
    table: docs_v1.Schema$StructuralElement["table"]
): string {
    if (!table) return ""
    let text = ""
    const { tableRows = [] } = table

    const rows: RawBlockTableRow[] = []

    for (const tableRow of tableRows) {
        const rawRow: RawBlockTableRow = {
            type: "table-row",
            value: {
                cells: [],
            },
        }
        const { tableCells = [] } = tableRow
        for (const tableCell of tableCells) {
            const rawCell: RawBlockTableCell = {
                type: "table-cell",
                value: [],
            }
            const { content = [] } = tableCell
            // Yes, we're "in a table" here, but this boolean is to track whether we should parse Gdocs tables
            // in the top level of the document, not once we're inside a table already
            const context = { isInList: false, isInTable: false }
            for (const item of content) {
                if (item.paragraph) {
                    const text = paragraphToString(item.paragraph, context)
                    const rawTextBlock: RawBlockText = {
                        type: "text",
                        value: text,
                    }
                    rawCell.value!.push(rawTextBlock)
                }
            }
            // Close the list if paragraphToString didn't close it itself (because the last item was still in a list)
            if (context.isInList) {
                rawCell.value!.push({ type: "text", value: "[]" })
            }
            rawRow.value!.cells!.push(rawCell)
        }
        rows.push(rawRow)
    }
    text += "\n[.+rows]"
    for (const row of rows) {
        text += `\n${OwidRawGdocBlockToArchieMLString(row)}`
    }
    text += "\n[]\n"
    return text
}

export async function gdocToArchie(
    document: docs_v1.Schema$Document
): Promise<{ text: string }> {
    // prepare the text holder
    let text = ""
    const context = { isInList: false, isInTable: false }

    // check if the body key and content key exists, and give up if not
    if (!document.body) return { text }
    if (!document.body.content) return { text }

    // loop through each content element in the body
    for (const element of document.body.content) {
        if (element.paragraph) {
            text += paragraphToString(element.paragraph, context)
        } else if (element.table) {
            // Skip parsing the Gdoc table if it's not enclosed in a {.table} tag
            if (context.isInTable) {
                text += tableToString(element.table)
            }
        }
    }
    return { text }
}

function parseParagraph(
    element: MergedParagraphElement
): Span | RawBlockHorizontalRule | null {
    // Check if this is a merged element created by mergeAdjacentLinkedElements
    if (element.__mergedSpan) {
        return element.__mergedSpan
    }

    // pull out the text
    const textRun = element.textRun

    // sometimes it's not there, skip this all if so
    if (textRun) {
        // sometimes the content isn't there, and if so, make it an empty string
        const content = textRun.content || ""

        let span: Span = { spanType: "span-simple-text", text: content }

        // If there's no URL, or other styling, or the content is just a newline, return without wrapping in anything else
        if (!textRun.textStyle || content === "\n") return span

        if (textRun.textStyle.link?.url)
            span = {
                spanType: "span-link",
                url: textRun.textStyle.link!.url!,
                children: [span],
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
    } else if (element.horizontalRule) {
        return { type: "horizontal-rule" }
    } else if (element.richLink && element.richLink.richLinkProperties) {
        // Rich links are special "pills" that Google Docs creates for links to other Google Docs or Google Drive files
        const richLinkProperties = element.richLink.richLinkProperties
        if (!richLinkProperties.uri) return null

        return {
            spanType: "span-link",
            url: richLinkProperties.uri,
            children: [
                {
                    spanType: "span-simple-text",
                    text: richLinkProperties.title ?? richLinkProperties.uri,
                },
            ],
        }
    } else {
        return null
    }
}
