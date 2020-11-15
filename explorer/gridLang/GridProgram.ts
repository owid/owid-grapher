import { imemo, trimMatrix } from "coreTable/CoreTableUtils"
import { GitCommit } from "gitCms/GitTypes"
import { isPresent } from "grapher/utils/Util"
import { GridCell } from "./GridCell"
import {
    CellDef,
    GRID_CELL_DELIMITER,
    GRID_EDGE_DELIMITER,
    GRID_NODE_DELIMITER,
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

    getCell(row: number, col: number): ParsedCell {
        return new GridCell(this.matrix, row, col, this.grammar!)
    }

    @imemo private get matrix() {
        return this.lines.map((line) => line.split(this.cellDelimiter))
    }

    setLineValue(key: string, value: string | undefined) {
        const index = this.getKeywordIndex(key)
        const newLine = `${key}${this.cellDelimiter}${value}`
        if (index === -1 && value !== undefined) this.lines.push(newLine)
        else if (value === undefined) this.lines = this.lines.splice(index, 1)
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

    protected appendBlock(key: string, value: string) {
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

    toArrays() {
        return this.lines.map((line) => line.split(this.cellDelimiter))
    }

    // The max number of columns in any row when you view a program as a spreadsheet
    get width() {
        return Math.max(...this.toArrays().map((arr) => arr.length))
    }

    toString() {
        return this.prettify()
    }

    protected prettify() {
        return trimMatrix(this.toArrays())
            .map((line) => line.join(this.cellDelimiter))
            .join(this.nodeDelimiter)
    }
}
