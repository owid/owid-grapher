import { trimMatrix } from "@ourworldindata/core-table"
import {
    isPresent,
    GitCommit,
    SerializedGridProgram,
} from "@ourworldindata/utils"

import { GridCell } from "./GridCell.js"
import {
    CellDef,
    CellPosition,
    GRID_CELL_DELIMITER,
    GRID_EDGE_DELIMITER,
    GRID_NODE_DELIMITER,
    Origin,
    ParsedCell,
} from "./GridLangConstants.js"
import { tsvToMatrix } from "./GrammarUtils.js"

/**
 * Block location for the below would be like (numRows = 2)
 * table             |
 *  slug name        | startRow = 1
 *  pop Population   | endRow   = 2
 */
interface BlockLocation {
    startRow: number
    endRow: number
    numRows: number
}

export class GridProgram {
    constructor(
        slug: string,
        tsv: string,
        lastCommit?: GitCommit,
        grammar?: CellDef
    ) {
        this.lines = tsvToMatrix(tsv.replace(/\r/g, ""))
        this.slug = slug
        this.lastCommit = lastCommit
        this.grammar = grammar
    }

    private grammar?

    private static guids = 0
    guid = ++GridProgram.guids

    lastCommit?: GitCommit
    slug: string

    private nodeDelimiter = GRID_NODE_DELIMITER
    cellDelimiter = GRID_CELL_DELIMITER
    private edgeDelimiter = GRID_EDGE_DELIMITER
    lines: string[][]

    toJson(): SerializedGridProgram {
        return {
            program: this.toString(),
            slug: this.slug,
            lastCommit: this.lastCommit,
        }
    }

    findNext(position: CellPosition) {
        const cell = this.getCell(position)
        const { contents } = cell
        return this.grepFirst(contents, {
            ...position,
            column: position.column + 1,
        })
    }

    findAll(position: CellPosition) {
        const cell = this.getCell(position)
        const { contents } = cell
        return this.grep(contents, {
            ...position,
            column: position.column + 1,
        })
    }

    private ring(position: CellPosition) {
        const lines = this.lines
        const numRows = lines.length
        if (!numRows)
            return (function* generator() {
                // no rows to iterate over
            })()
        const pointer = {
            ...position,
            started: false,
            endRow: position.row,
            endCol: position.column,
        }
        if (pointer.row >= numRows) pointer.endRow = numRows - 1

        const lastLine = lines[pointer.endRow]
        pointer.endCol =
            lastLine[pointer.endCol] === undefined
                ? lastLine.length
                : pointer.endCol
        function* generator() {
            while (true) {
                if (
                    pointer.started &&
                    pointer.row === pointer.endRow &&
                    pointer.column === pointer.endCol
                )
                    return
                pointer.started = true

                if (
                    lines[pointer.row] === undefined ||
                    lines[pointer.row][pointer.column] === undefined
                ) {
                    pointer.row++
                    pointer.column = 0
                    if (pointer.row >= numRows) pointer.row = 0
                    continue
                }

                yield {
                    row: pointer.row,
                    column: pointer.column,
                } as CellPosition
                pointer.column++
            }
        }

        return generator()
    }

    valuesFrom(position = Origin) {
        return Array.from(this.ring(position)).map((next) =>
            this.getCellContents(next)
        )
    }

    get numRows() {
        return this.lines.length
    }

    patch(obj: any) {
        Object.keys(obj).forEach((key) => this.setLineValue(key, obj[key]))
        return this
    }

    grepFirst(key: string, position = Origin) {
        for (const next of this.ring(position)) {
            if (this.getCellContents(next) === key) return next
        }
        return undefined
    }

    grep(key: string, position = Origin) {
        const hits: CellPosition[] = []
        for (const next of this.ring(position)) {
            if (this.getCellContents(next) === key) hits.push(next)
        }
        return hits
    }

    /**
     * Returns all non-blocks as an object literal
     */
    get tuplesObject() {
        const obj: { [key: string]: any } = {}
        this.lines
            .filter((line) => line[0] !== "")
            .forEach((line) => {
                const [key, ...rest] = line
                if (key) obj[key.trim()] = rest.join(this.cellDelimiter).trim()
            })
        return obj
    }

    getLine(keyword: string) {
        return this.lines.find((line) => line[0] === keyword)
    }

    getLineValue(keyword: string) {
        const line = this.getLine(keyword)
        return line?.[1]
    }

    protected getBlockLocation(
        blockRowNumber: number
    ): BlockLocation | undefined {
        const startRow = blockRowNumber + 1
        let numRows = this.lines
            .slice(startRow)
            .findIndex((line) => line.length && line[0] !== "")
        if (numRows === 0) return undefined
        if (numRows === -1) numRows = this.lines.slice(startRow).length
        return { startRow, endRow: startRow + numRows, numRows }
    }

    getKeywordIndex(key: string) {
        return this.lines.findIndex((line) => line[0] === key)
    }

    getCell(position: CellPosition): ParsedCell {
        return new GridCell(this.lines, position, this.grammar!)
    }

    getCellContents(position: CellPosition) {
        const line = this.lines[position.row]
        return line ? line[position.column] : undefined
    }

    deleteBlock(row?: number) {
        if (row === undefined) return this
        const location = this.getBlockLocation(row)
        if (!location) return this

        this.lines.splice(location.startRow, location.numRows)
        return this
    }

    deleteLine(row?: number) {
        if (row === undefined) return this
        this.lines.splice(row, 1)
        return this
    }

    appendLine(line: string) {
        this.lines.push(line.split(this.cellDelimiter))
        return this
    }

    // todo: make immutable and return a new copy
    setCell(row: number, col: number, value: string) {
        this.lines[row][col] = value
        return this
    }

    setLineValue(key: string, value: string | undefined) {
        const index = this.getKeywordIndex(key)
        if (index === -1 && value !== undefined) this.lines.push([key, value])
        else if (value === undefined) this.deleteLine(index)
        else this.lines[index] = [key, value]
        return this
    }

    getBlock(keywordIndex: number) {
        const location = this.getBlockLocation(keywordIndex)
        if (!location) return undefined
        return this.lines
            .slice(location.startRow, location.endRow)
            .map((line) => line.slice(1))
    }

    updateBlock(rowNumber: number, value: string[][]) {
        const location = this.getBlockLocation(rowNumber)
        if (!location) throw new Error("Block not found")
        this.lines.splice(
            location.startRow,
            location.numRows,
            ...value.map((line) => ["", ...line])
        )
        return this
    }

    protected appendBlock(key: string, value: string[][]) {
        this.lines.push([key])
        value.forEach((line) => this.lines.push(["", ...line]))
    }

    getRowNumbersStartingWith(startsWith: string) {
        return this.lines
            .map((line, index) => (line[0] === startsWith ? index : null))
            .filter(isPresent)
    }

    private static lineMatchesWords = (
        line: string[],
        words: (string | undefined)[]
    ): boolean =>
        words.every((word, index) => word === undefined || line[index] === word)

    getRowMatchingWords(...words: (string | undefined)[]): number {
        return this.lines.findIndex((line) =>
            GridProgram.lineMatchesWords(line, words)
        )
    }

    getAllRowsMatchingWords(...words: (string | undefined)[]): number[] {
        const rows: number[] = []
        this.lines.forEach((line: string[], rowIndex: number) => {
            if (GridProgram.lineMatchesWords(line, words)) rows.push(rowIndex)
        })
        return rows
    }

    // The max number of columns in any row when you view a program as a spreadsheet
    get width() {
        return Math.max(...this.lines.map((arr) => arr.length))
    }

    toString() {
        return this.prettify()
    }

    protected prettify() {
        return trimMatrix(this.lines)
            .map((line) => line.join(this.cellDelimiter))
            .join(this.nodeDelimiter)
    }
}
