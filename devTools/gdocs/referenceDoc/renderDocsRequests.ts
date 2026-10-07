/*
 * Document model → Google Docs batchUpdate requests. Pure: nothing here
 * talks to Google, so it is testable offline and drives `--dry-run
 * --requests`.
 *
 * Writing happens in two passes, because the Docs API does not document how
 * table cell indices are laid out:
 *
 *   Pass 1 (`blocksToRequests`) appends every block at the end of the tab —
 *   text with `insertText` at `endOfSegmentLocation`, tables as EMPTY
 *   `insertTable`s — and styles the text by absolute ranges computed from a
 *   running cursor. Inserted text inherits the style of what precedes it, and
 *   a new paragraph copies the previous paragraph's style (bullets included),
 *   so each block first resets text and paragraph style over its own range.
 *
 *   Pass 2 (`fillTableRequests`) fills the cells once the caller has
 *   re-fetched the tab and read the real cell indices. It goes from the last
 *   table to the first, and within a table from the last cell to the first,
 *   so every index it uses is still valid when its request runs.
 *
 * Indices are UTF-16 code units, like JavaScript string lengths. A cleared
 * tab has end index 2 (one trailing newline that cannot be deleted), so the
 * first insert lands at 1.
 */

import type { docs_v1 } from "@googleapis/docs"
import type { Block, HeadingLevel, Run, TableBlock } from "./model.js"
import { runsToPlainText } from "./model.js"

type Request = docs_v1.Schema$Request

/** A Schema$Range with every field set */
interface TextRange {
    startIndex: number
    endIndex: number
    tabId: string
}

export const MONOSPACE_FONT = "Roboto Mono"
export const BULLET_PRESET = "BULLET_DISC_CIRCLE_SQUARE"
export const MAX_REQUESTS_PER_CHUNK = 200
/** Well under the API's request-size limit, with room for JSON overhead */
export const MAX_BYTES_PER_CHUNK = 2_000_000

/** Every text style a run can set — reset before each block's own styles */
const RESET_TEXT_FIELDS =
    "weightedFontFamily,bold,italic,link,underline,foregroundColor"

const LINK_COLOR = {
    color: { rgbColor: { red: 0.07, green: 0.33, blue: 0.8 } },
}

/** A table inserted empty in pass 1, waiting for its cell text in pass 2 */
export interface PlannedTable {
    /** Model index the table starts at after pass 1 (the newline before it excluded) */
    startIndex: number
    rows: number
    columns: number
    /** rows → cells → runs, header row first */
    cells: Run[][][]
}

export interface Pass1Result {
    requests: Request[]
    tables: PlannedTable[]
    /** Model index right after the last inserted block */
    endIndex: number
}

/** Where a table and its cells actually are, read back from `documents.get` */
export interface LocatedTable {
    startIndex: number
    rows: number
    columns: number
    /** rows → cells → model index where the cell's text goes */
    cellIndexes: number[][]
}

/**
 * Model indices an empty table occupies: one for the table, one per row, one
 * per cell plus that cell's empty paragraph, one closing the table.
 */
export function emptyTableSpan(rows: number, columns: number): number {
    return 2 + rows * (1 + 2 * columns)
}

export function blocksToRequests(
    blocks: Block[],
    tabId: string,
    startIndex: number = 1
): Pass1Result {
    const writer = new RequestWriter(tabId, startIndex)
    for (const block of blocks) writer.append(block)
    return writer.result()
}

class RequestWriter {
    private readonly requests: Request[] = []
    private readonly tables: PlannedTable[] = []
    private cursor: number
    /** The previous block left bulleted paragraphs the next one would inherit */
    private afterBullets = false

    constructor(
        private readonly tabId: string,
        startIndex: number
    ) {
        this.cursor = startIndex
    }

    result(): Pass1Result {
        return {
            requests: this.requests,
            tables: this.tables,
            endIndex: this.cursor,
        }
    }

    append(block: Block): void {
        switch (block.type) {
            case "heading":
                this.appendText(block.text + "\n", `HEADING_${block.level}`)
                return
            case "paragraph": {
                const range = this.appendText(
                    runsToPlainText(block.runs) + "\n",
                    "NORMAL_TEXT"
                )
                this.styleRuns(block.runs, range.startIndex)
                return
            }
            case "code": {
                const range = this.appendText(block.text + "\n", "NORMAL_TEXT")
                this.requests.push(
                    textStyleRequest(range, { code: true, text: "" })!
                )
                return
            }
            case "bullets":
                this.appendBullets(block.items)
                return
            case "table":
                this.appendTable(block)
                return
        }
    }

    /** Inserts text at the end of the tab and resets its styles; returns its range */
    private appendText(
        text: string,
        namedStyleType: `HEADING_${HeadingLevel}` | "NORMAL_TEXT"
    ): TextRange {
        const range = this.insertAtEnd(text)
        this.requests.push({
            updateTextStyle: {
                range,
                textStyle: {},
                fields: RESET_TEXT_FIELDS,
            },
        })
        this.requests.push({
            updateParagraphStyle: {
                range,
                paragraphStyle: { namedStyleType },
                fields: "namedStyleType",
            },
        })
        if (this.afterBullets) {
            this.requests.push({ deleteParagraphBullets: { range } })
            this.afterBullets = false
        }
        return range
    }

    private appendBullets(items: Run[][]): void {
        const text = items.map(runsToPlainText).join("\n") + "\n"
        const range = this.appendText(text, "NORMAL_TEXT")
        this.requests.push({
            createParagraphBullets: { range, bulletPreset: BULLET_PRESET },
        })
        let offset = range.startIndex
        for (const item of items) {
            this.styleRuns(item, offset)
            offset += runsToPlainText(item).length + 1
        }
        this.afterBullets = true
    }

    private appendTable(block: TableBlock): void {
        // A table's leading newline would inherit a bullet from a preceding
        // list; park it in a plain paragraph instead.
        if (this.afterBullets) this.appendText("\n", "NORMAL_TEXT")
        const rows = block.rows.length + 1
        const columns = block.header.length
        this.requests.push({
            insertTable: {
                rows,
                columns,
                endOfSegmentLocation: { tabId: this.tabId },
            },
        })
        // insertTable puts a newline before the table
        const startIndex = this.cursor + 1
        this.cursor = startIndex + emptyTableSpan(rows, columns)
        this.tables.push({
            startIndex,
            rows,
            columns,
            cells: [
                block.header.map((title) => [{ text: title, bold: true }]),
                ...block.rows,
            ],
        })
    }

    private insertAtEnd(text: string): TextRange {
        const range = {
            startIndex: this.cursor,
            endIndex: this.cursor + text.length,
            tabId: this.tabId,
        }
        this.requests.push({
            insertText: { text, endOfSegmentLocation: { tabId: this.tabId } },
        })
        this.cursor = range.endIndex
        return range
    }

    private styleRuns(runs: Run[], startIndex: number): void {
        this.requests.push(...runStyleRequests(runs, startIndex, this.tabId))
    }
}

/** One updateTextStyle per run that has any formatting */
function runStyleRequests(
    runs: Run[],
    startIndex: number,
    tabId: string
): Request[] {
    const requests: Request[] = []
    let offset = startIndex
    for (const run of runs) {
        const range = {
            startIndex: offset,
            endIndex: offset + run.text.length,
            tabId,
        }
        const request = textStyleRequest(range, run)
        if (request && run.text.length > 0) requests.push(request)
        offset = range.endIndex
    }
    return requests
}

function textStyleRequest(
    range: docs_v1.Schema$Range,
    run: Run
): Request | undefined {
    const textStyle: docs_v1.Schema$TextStyle = {}
    const fields: string[] = []
    if (run.code) {
        textStyle.weightedFontFamily = { fontFamily: MONOSPACE_FONT }
        fields.push("weightedFontFamily")
    }
    if (run.bold) {
        textStyle.bold = true
        fields.push("bold")
    }
    if (run.italic) {
        textStyle.italic = true
        fields.push("italic")
    }
    if (run.link) {
        textStyle.link = { url: run.link }
        textStyle.underline = true
        textStyle.foregroundColor = LINK_COLOR
        fields.push("link", "underline", "foregroundColor")
    }
    if (fields.length === 0) return undefined
    return { updateTextStyle: { range, textStyle, fields: fields.join(",") } }
}

/**
 * Reads back the tables of a tab body (top-level only — this document nests
 * none) in document order, with the index each cell's text must go to: the
 * start of the cell's first, empty paragraph.
 */
export function locateTables(
    content: docs_v1.Schema$StructuralElement[]
): LocatedTable[] {
    const located: LocatedTable[] = []
    for (const element of content) {
        const table = element.table
        const startIndex = element.startIndex
        if (!table || startIndex === undefined || startIndex === null) continue
        located.push({
            startIndex,
            rows: table.rows ?? 0,
            columns: table.columns ?? 0,
            cellIndexes: (table.tableRows ?? []).map((row) =>
                (row.tableCells ?? []).map((cell) => {
                    const index = cell.content?.[0]?.startIndex
                    if (index === undefined || index === null)
                        throw new Error(
                            `Table at index ${element.startIndex} has a cell without content`
                        )
                    return index
                })
            ),
        })
    }
    return located
}

/**
 * Pass 2: the cell text for every planned table, from the indices read back
 * after pass 1. Throws when the tables found don't match the plan — the
 * styles pass 1 applied after that table would then be off too, so the run
 * must not continue quietly.
 */
export function fillTableRequests(
    planned: PlannedTable[],
    located: LocatedTable[],
    tabId: string
): Request[] {
    if (planned.length !== located.length)
        throw new Error(
            `Planned ${planned.length} tables but found ${located.length} in the tab`
        )
    const requests: Request[] = []
    for (let t = planned.length - 1; t >= 0; t--) {
        const plan = planned[t]
        const real = located[t]
        if (
            plan.rows !== real.rows ||
            plan.columns !== real.columns ||
            plan.startIndex !== real.startIndex
        )
            throw new Error(
                `Table ${t + 1} differs from the plan: planned ${plan.rows}x${plan.columns} at ${plan.startIndex}, found ${real.rows}x${real.columns} at ${real.startIndex}`
            )
        for (let r = plan.rows - 1; r >= 0; r--) {
            for (let c = plan.columns - 1; c >= 0; c--) {
                const runs = plan.cells[r]?.[c] ?? []
                const text = runsToPlainText(runs)
                if (text.length === 0) continue
                const index = real.cellIndexes[r][c]
                requests.push({
                    insertText: { text, location: { index, tabId } },
                })
                requests.push(...runStyleRequests(runs, index, tabId))
            }
        }
    }
    return requests
}

/**
 * Splits requests into batchUpdate-sized chunks, by count and by JSON size.
 * Requests stay in order, so absolute indices computed for a later chunk
 * still hold when it runs.
 */
export function chunkRequests(
    requests: Request[],
    maxPerChunk: number = MAX_REQUESTS_PER_CHUNK,
    maxBytes: number = MAX_BYTES_PER_CHUNK
): Request[][] {
    const chunks: Request[][] = []
    let current: Request[] = []
    let currentBytes = 0
    for (const request of requests) {
        const bytes = Buffer.byteLength(JSON.stringify(request))
        if (
            current.length > 0 &&
            (current.length >= maxPerChunk || currentBytes + bytes > maxBytes)
        ) {
            chunks.push(current)
            current = []
            currentBytes = 0
        }
        current.push(request)
        currentBytes += bytes
    }
    if (current.length > 0) chunks.push(current)
    return chunks
}
