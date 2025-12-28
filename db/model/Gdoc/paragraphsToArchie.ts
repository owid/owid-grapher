import {
    type GdocParagraph,
    type RawBlockHeading,
    type RawBlockHorizontalRule,
    type RawBlockTableCell,
    type RawBlockTableRow,
    type RawBlockText,
} from "@ourworldindata/types"
import { spansToHtmlString } from "./gdocUtils.js"
import { OwidRawGdocBlockToArchieMLString } from "./rawToArchie.js"
import { parseScopeMarkerParagraph } from "./archieParagraphParser.js"

interface ArchieRenderContext {
    isInList: boolean
    isInTable: boolean
}

type TableCellMap = Map<number, Map<number, GdocParagraph[]>>
type TableMap = Map<number, TableCellMap>

function getHeadingLevel(paragraphStyle?: string): string | undefined {
    if (!paragraphStyle) return undefined
    if (!paragraphStyle.includes("HEADING")) return undefined
    return paragraphStyle.replace("HEADING_", "")
}

function paragraphToArchieString(
    paragraph: GdocParagraph,
    context: ArchieRenderContext
): string {
    if (paragraph.type === "horizontal-rule") {
        const rawBlock: RawBlockHorizontalRule = { type: "horizontal-rule" }
        return OwidRawGdocBlockToArchieMLString(rawBlock)
    }

    let text = ""
    const needsBullet = Boolean(paragraph.list)

    if (needsBullet && !context.isInList) {
        context.isInList = true
        text += `\n[.list]\n`
    } else if (!needsBullet && context.isInList) {
        context.isInList = false
        text += `[]\n`
    }

    const headingLevel = getHeadingLevel(paragraph.paragraphStyle)
    const elementText = spansToHtmlString(paragraph.spans)

    if (headingLevel) {
        const heading: RawBlockHeading = {
            type: "heading",
            value: {
                text: elementText.trim(),
                level: headingLevel,
            },
        }
        text += `\n${OwidRawGdocBlockToArchieMLString(heading)}`
        return text
    }

    const prefix = needsBullet ? "* " : ""
    text += `${prefix}${elementText}`
    return text
}

function collectTables(paragraphs: GdocParagraph[]): TableMap {
    const tables: TableMap = new Map()

    for (const paragraph of paragraphs) {
        const context = paragraph.tableContext
        if (!context) continue

        const table = tables.get(context.tableIndex) ?? new Map()
        const row = table.get(context.rowIndex) ?? new Map()
        const cell = row.get(context.columnIndex) ?? []

        cell.push(paragraph)
        row.set(context.columnIndex, cell)
        table.set(context.rowIndex, row)
        tables.set(context.tableIndex, table)
    }

    return tables
}

function tableMapToArchieString(
    table: TableCellMap
): string {
    let text = "\n[.+rows]"
    const rowIndices = Array.from(table.keys()).sort((a, b) => a - b)

    for (const rowIndex of rowIndices) {
        const row = table.get(rowIndex)
        if (!row) continue

        const rawRow: RawBlockTableRow = {
            type: "table-row",
            value: { cells: [] },
        }

        const columnIndices = Array.from(row.keys()).sort((a, b) => a - b)

        for (const columnIndex of columnIndices) {
            const paragraphs = row.get(columnIndex) ?? []
            const rawCell: RawBlockTableCell = {
                type: "table-cell",
                value: [],
            }
            const context: ArchieRenderContext = {
                isInList: false,
                isInTable: false,
            }
            const sortedParagraphs = [...paragraphs].sort(
                (a, b) => a.index - b.index
            )

            for (const paragraph of sortedParagraphs) {
                const cellText = paragraphToArchieString(paragraph, context)
                const rawTextBlock: RawBlockText = {
                    type: "text",
                    value: cellText,
                }
                rawCell.value!.push(rawTextBlock)
            }

            if (context.isInList) {
                rawCell.value!.push({ type: "text", value: "[]" })
            }

            rawRow.value!.cells!.push(rawCell)
        }

        text += `\n${OwidRawGdocBlockToArchieMLString(rawRow)}`
    }

    text += "\n[]\n"
    return text
}

export function paragraphsToArchieText(
    paragraphs: GdocParagraph[]
): string {
    let text = ""
    const context: ArchieRenderContext = {
        isInList: false,
        isInTable: false,
    }
    const tables = collectTables(paragraphs)
    const emittedTables = new Set<number>()

    for (const paragraph of paragraphs) {
        if (paragraph.tableContext) {
            if (!context.isInTable) continue

            const tableIndex = paragraph.tableContext.tableIndex
            if (emittedTables.has(tableIndex)) continue

            const table = tables.get(tableIndex)
            if (table) {
                text += tableMapToArchieString(table)
                emittedTables.add(tableIndex)
            }
            continue
        }

        const marker = parseScopeMarkerParagraph(paragraph)
        if (marker && marker.bracket === "{" && marker.slug === "table") {
            context.isInTable = true
        } else if (
            marker &&
            marker.bracket === "{" &&
            marker.slug === "" &&
            context.isInTable
        ) {
            context.isInTable = false
        }

        text += paragraphToArchieString(paragraph, context)
    }

    return text
}
