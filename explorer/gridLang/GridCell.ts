import { imemo, trimArray } from "coreTable/CoreTableUtils"
import { isPresent } from "grapher/utils/Util"
import { didYouMean, isBlankLine, isEmpty } from "./GrammarUtils"
import {
    CellCoordinate,
    CellLink,
    CellDef,
    CellHasErrorsClass,
    MatrixLine,
    MatrixProgram,
    KeywordMap,
    FrontierCellClass,
    ParsedCell,
    CommentCellDef,
    SubTableHeaderCellDef,
    SubTableValueCellDef,
    WorkInProgressCellDef,
    NothingGoesThereCellDef,
} from "./GridLangConstants"

export class GridCell implements ParsedCell {
    private row: CellCoordinate
    private column: CellCoordinate
    private matrix: MatrixProgram
    private rootDefinition: CellDef
    constructor(
        matrix: MatrixProgram,
        row: CellCoordinate,
        column: CellCoordinate,
        rootDefinition: CellDef
    ) {
        this.row = row
        this.column = column
        this.matrix = matrix
        this.rootDefinition = rootDefinition
    }

    private get line(): MatrixLine | undefined {
        return this.matrix[this.row]
    }

    private get isCommentCell() {
        const { value } = this
        return value && CommentCellDef.regex!.test(value)
    }

    private get cellTerminalTypeDefinition(): CellDef | undefined {
        const { rootDefinition } = this
        if (this.isCommentCell) return CommentCellDef
        const keywordMap = (rootDefinition.keywordMap as unknown) as KeywordMap
        if (this.column === 0) return (rootDefinition as unknown) as CellDef
        const firstWordOnLine = this.line ? this.line[0] : undefined
        const isFirstWordAKeyword =
            firstWordOnLine && keywordMap[firstWordOnLine] !== undefined
        if (this.column === 1 && firstWordOnLine && isFirstWordAKeyword)
            return keywordMap[firstWordOnLine]

        if (!isFirstWordAKeyword) return undefined

        // It has a keyword but it is column 2+
        const def = keywordMap[firstWordOnLine!]
        const cellTypeDef = def.rest && def.rest[this.column - 2]
        if (cellTypeDef) return cellTypeDef
        return NothingGoesThereCellDef
    }

    @imemo private get subTableParseResults() {
        if (this.cellTerminalTypeDefinition) return undefined

        let start = this.row
        while (start) {
            const parentLine = this.matrix[start - 1]
            if (!parentLine) return undefined
            const parentKeyword = parentLine[0]
            if (parentKeyword) {
                const subTableDef = (this.rootDefinition.keywordMap as any)[
                    parentKeyword
                ] as CellDef
                if (!subTableDef || !subTableDef.headerCellDef) return undefined
                const isHeaderValue = this.row === start && this.value
                const isFrontierCell = this.isSubtTableFrontierCell(
                    start,
                    subTableDef
                )
                return {
                    isFrontierCell,
                    isHeaderValue,
                    def:
                        isHeaderValue || isFrontierCell
                            ? subTableDef.headerCellDef ?? SubTableHeaderCellDef
                            : SubTableValueCellDef,
                }
            }
            start--
        }
        return undefined
    }

    /**
     * If a cell is:
     *  - to the right of the last filled cell in a line
     *  - and that line is indented to be part of a subtable, with options
     *  - and it is the first non-blank line in the subtabel
     *
     * Then consider is a "frontier cell"
     *
     */
    private isSubtTableFrontierCell(start: number, subTableDef: CellDef) {
        const { line, column, row } = this
        const keywordMap = subTableDef.headerCellDef!.keywordMap
        const isToTheImmediateRightOfLastFullCell =
            line && trimArray(line).length === column
        return (
            row === start &&
            !isBlankLine(line) &&
            isToTheImmediateRightOfLastFullCell &&
            keywordMap &&
            Object.keys(keywordMap).length
        )
    }

    // If true show a +
    private get isFirstCellOnFrontierRow() {
        const { row, column } = this
        const numRows = this.matrix.length
        if (column) return false // Only first column should have a +
        if (!isBlankLine(this.line)) return false // Only blank lines can be frontier
        if (numRows === 1) {
            if (row === 1) return !isBlankLine(this.matrix[0])
            return row === 0
        }
        return row === numRows
    }

    private get suggestions() {
        return []
    }

    private get definitionLinks(): CellLink[] {
        return []
    }

    private get implementationLinks(): CellLink[] {
        return []
    }

    @imemo get cellDef(): CellDef {
        const def = this.cellTerminalTypeDefinition
        if (def) return def

        const subTable = this.subTableParseResults?.def
        if (subTable) return (subTable as unknown) as CellDef

        return WorkInProgressCellDef
    }

    get errorMessage() {
        if (!this.line) return ""
        const { cellDef, value, options } = this
        const { regex, requirements, catchAllKeyword } = cellDef
        const catchAllKeywordRegex = catchAllKeyword?.regex

        if (value === undefined || value === "") return ""

        if (options) {
            if (options.includes(value)) return ""

            const guess = didYouMean(value, options)
            if (guess) return `Did you mean '${guess}'?`
        }

        if (regex) return validate(value, regex, requirements)

        if (catchAllKeywordRegex)
            return validate(
                value,
                catchAllKeywordRegex,
                catchAllKeyword!.requirements
            )

        if (options)
            return `Error: '${value}' is not a valid option. Valid options are ${options
                .map((opt) => `'${opt}'`)
                .join(", ")}`

        return ""
    }

    get value() {
        return this.line ? this.line[this.column] : undefined
    }

    get comment() {
        const { value, errorMessage, cellDef } = this
        if (isEmpty(value)) return undefined
        if (errorMessage) return errorMessage

        if (cellDef.keywordMap) {
            const def = cellDef.keywordMap[value!] ?? cellDef.catchAllKeyword
            return def.description
        }

        return [cellDef.description].join("\n")
    }

    get cssClasses() {
        const { errorMessage, cellDef } = this
        if (errorMessage) return [CellHasErrorsClass]
        const showArrow =
            this.isFirstCellOnFrontierRow ||
            this.subTableParseResults?.isFrontierCell
                ? FrontierCellClass
                : undefined
        const hasSuggestions =
            this.cellDef.keyword === "table" ? "HasSuggestions" : null
        return [cellDef.cssClass, hasSuggestions, showArrow].filter(isPresent)
    }

    get placeholder() {
        const { value, cellDef } = this
        const placeholder =
            cellDef.placeholder ?? (cellDef.options && cellDef.options[0])
        return isEmpty(value) && placeholder ? `eg "${placeholder}"` : undefined
    }

    get options() {
        const { cellDef } = this
        const { keywordMap, headerCellDef, options } = cellDef
        return options
            ? options
            : keywordMap
            ? Object.keys(keywordMap)
            : headerCellDef
            ? Object.keys(headerCellDef.keywordMap!)
            : undefined
    }
}

const validate = (value: any, regex: RegExp, requirements?: string) => {
    if (typeof value !== "string") return ""
    if (!regex.test(value)) {
        return `Error: ${
            requirements
                ? requirements
                : `'${value}' did not validate against ${regex}`
        }`
    }
    return ""
}
