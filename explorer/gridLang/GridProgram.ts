import { imemo, trimMatrix } from "coreTable/CoreTableUtils"
import { GitCommit } from "gitCms/GitTypes"
import { isPresent } from "grapher/utils/Util"
import { GridCell } from "./GridCell"
import {
    CellDef,
    CellPosition,
    GRID_CELL_DELIMITER,
    GRID_EDGE_DELIMITER,
    GRID_NODE_DELIMITER,
    Origin,
    ParsedCell,
} from "./GridLangConstants"
import { SerializedGridProgram } from "./SerializedGridProgram"

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
        this.lines = tsv.replace(/\r/g, "").split(this.nodeDelimiter)
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
    lines: string[]

    toJson(): SerializedGridProgram {
        return {
            program: this.toString(),
            slug: this.slug,
            lastCommit: this.lastCommit,
        }
    }

    findNext(position: CellPosition) {
        const cell = this.getCell(position)
        const { value } = cell
        return this.grepFirst(value, {
            ...position,
            column: position.column + 1,
        })
    }

    findAll(position: CellPosition) {
        const cell = this.getCell(position)
        const { value } = cell
        return this.grep(value, {
            ...position,
            column: position.column + 1,
        })
    }

    private ring(position: CellPosition) {
        const matrix = this.asArrays
        const numRows = matrix.length
        if (!numRows) return (function* generator() {})()
        const pointer = {
            ...position,
            started: false,
            endRow: position.row,
            endCol: position.column,
        }
        if (pointer.row >= numRows) pointer.endRow = numRows - 1

        const lastLine = matrix[pointer.endRow]
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
                    matrix[pointer.row] === undefined ||
                    matrix[pointer.row][pointer.column] === undefined
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
            this.getCellValue(next)
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
            if (this.getCellValue(next) === key) return next
        }
        return undefined
    }

    grep(key: string, position = Origin) {
        const hits: CellPosition[] = []
        for (const next of this.ring(position)) {
            if (this.getCellValue(next) === key) hits.push(next)
        }
        return hits
    }

    /**
     * Returns all non-blocks as an object literal
     */
    get tuplesObject() {
        const obj: { [key: string]: any } = {}
        this.lines
            .filter((line) => !line.startsWith(this.edgeDelimiter))
            .forEach((line) => {
                const words = line.split(this.cellDelimiter)
                const key = words.shift()
                if (key) obj[key.trim()] = words.join(this.cellDelimiter).trim()
            })
        return obj
    }

    getLineValue(keyword: string) {
        const line = this.lines.find((line) =>
            line.startsWith(keyword + this.cellDelimiter)
        )
        return line ? line.split(this.cellDelimiter)[1] : undefined
    }

    protected getBlockLocation(blockRowNumber: number): BlockLocation {
        const startRow = blockRowNumber + 1
        let numRows = this.lines
            .slice(startRow)
            .findIndex((line) => line && !line.startsWith(this.edgeDelimiter))
        if (numRows === -1) numRows = this.lines.slice(startRow).length
        return { startRow, endRow: startRow + numRows, numRows }
    }

    protected getKeywordIndex(key: string) {
        return this.lines.findIndex(
            (line) => line.startsWith(key + this.cellDelimiter) || line === key
        )
    }

    getCell(position: CellPosition): ParsedCell {
        return new GridCell(this.matrix, position, this.grammar!)
    }

    getCellValue(position: CellPosition) {
        const line = this.matrix[position.row]
        return line ? line[position.column] : undefined
    }

    @imemo private get matrix() {
        return this.lines.map((line) => line.split(this.cellDelimiter))
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
        this.lines.push(line)
        return this
    }

    // todo: make immutable and return a new copy
    setCell(row: number, col: number, value: string) {
        const line = this.lines[row]
        const words = line.split(this.cellDelimiter)
        words[col] = value
        this.lines[row] = words.join(this.cellDelimiter)
        return this
    }

    setLineValue(key: string, value: string | undefined) {
        const index = this.getKeywordIndex(key)
        const newLine = `${key}${this.cellDelimiter}${value}`
        if (index === -1 && value !== undefined) this.lines.push(newLine)
        else if (value === undefined) this.deleteLine(index)
        else this.lines[index] = newLine
        return this
    }

    getBlock(keywordIndex: number) {
        const location = this.getBlockLocation(keywordIndex)
        return this.lines
            .slice(location.startRow, location.endRow)
            .map((line) => line.substr(1))
            .join(this.nodeDelimiter)
    }

    updateBlock(rowNumber: number, value: string) {
        const location = this.getBlockLocation(rowNumber)
        this.lines.splice(
            location.startRow,
            location.numRows,
            ...value
                .split(this.nodeDelimiter)
                .map((line) => this.edgeDelimiter + line)
        )
        return this
    }

    appendBlock(key: string, value: string) {
        this.lines.push(key)
        value
            .split(this.nodeDelimiter)
            .forEach((line) => this.lines.push(this.edgeDelimiter + line))
    }

    getRowNumbersStartingWith(startsWith: string) {
        return this.lines
            .map((line, index) =>
                line.startsWith(startsWith + this.cellDelimiter) ||
                line === startsWith
                    ? index
                    : null
            )
            .filter(isPresent)
    }

    getRowMatchingWords(...words: (string | undefined)[]) {
        const matches = (line: string[]) =>
            words.every(
                (word, index) => word === undefined || line[index] === word
            )
        return this.asArrays.findIndex(matches)
    }

    get asArrays() {
        return this.lines.map((line) => line.split(this.cellDelimiter))
    }

    // The max number of columns in any row when you view a program as a spreadsheet
    get width() {
        return Math.max(...this.asArrays.map((arr) => arr.length))
    }

    toString() {
        return this.prettify()
    }

    protected prettify() {
        return trimMatrix(this.asArrays)
            .map((line) => line.join(this.cellDelimiter))
            .join(this.nodeDelimiter)
    }
}
