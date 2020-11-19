import { imemo, trimArray } from "coreTable/CoreTableUtils"
import { isPresent } from "grapher/utils/Util"
import { didYouMean, isBlankLine, isEmpty } from "./GrammarUtils"
import {
    CellPosition,
    CellDef,
    CellHasErrorsClass,
    MatrixLine,
    MatrixProgram,
    Grammar,
    FrontierCellClass,
    ParsedCell,
    CommentCellDef,
    SubTableHeaderCellDef,
    SubTableValueCellDef,
    WorkInProgressCellDef,
    NothingGoesThereCellDef,
} from "./GridLangConstants"

export class GridCell implements ParsedCell {
    private position: CellPosition
    private matrix: MatrixProgram
    private rootDefinition: CellDef
    constructor(
        matrix: MatrixProgram,
        position: CellPosition,
        rootDefinition: CellDef
    ) {
        this.position = position
        this.matrix = matrix
        this.rootDefinition = rootDefinition
    }

    private get row() {
        return this.position.row
    }

    private get column() {
        return this.position.column
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
        const grammar = (rootDefinition.grammar as unknown) as Grammar
        if (this.column === 0) return (rootDefinition as unknown) as CellDef
        const firstWordOnLine = this.line ? this.line[0] : undefined
        const isFirstWordAKeyword =
            firstWordOnLine && grammar[firstWordOnLine] !== undefined
        if (this.column === 1 && firstWordOnLine && isFirstWordAKeyword)
            return grammar[firstWordOnLine]

        if (!isFirstWordAKeyword) return undefined

        // It has a keyword but it is column 2+
        const def = grammar[firstWordOnLine!]
        const cellTypeDef = def.rest && def.rest[this.column - 2]
        if (cellTypeDef) return cellTypeDef
        return NothingGoesThereCellDef
    }

    private get parentSubTableInfo() {
        const { row, matrix } = this
        let pointerRow = row
        let subTableHeaderRow = -1
        while (pointerRow >= 0) {
            const line = matrix[pointerRow]
            if (!line) break
            const parentKeyword = line[0]
            if (parentKeyword) {
                if (subTableHeaderRow === -1) return undefined
                return {
                    parentKeyword,
                    parentRow: pointerRow,
                    subTableHeaderRow,
                    isCellInHeader: row === subTableHeaderRow,
                    headerKeyword: matrix[subTableHeaderRow][this.column],
                }
            }

            if (!isBlankLine(line)) subTableHeaderRow = pointerRow
            pointerRow--
        }

        return undefined
    }

    @imemo private get subTableParseResults() {
        const { cellTerminalTypeDefinition } = this
        if (cellTerminalTypeDefinition) return undefined

        const info = this.parentSubTableInfo

        if (!info) return undefined

        const {
            parentKeyword,
            isCellInHeader,
            subTableHeaderRow,
            headerKeyword,
        } = info

        const subTableDef = this.rootDefinition.grammar![parentKeyword]

        const headerCellDef = subTableDef && subTableDef.headerCellDef

        if (!headerCellDef) return undefined

        const headerGrammar = headerCellDef.grammar
        const valueCellDef =
            !isCellInHeader && headerGrammar
                ? headerGrammar[headerKeyword]
                : undefined

        return {
            isFrontierCell: this.isSubTableFrontierCell(
                subTableHeaderRow,
                subTableDef
            ),
            def: isCellInHeader
                ? headerCellDef
                : valueCellDef ?? SubTableValueCellDef,
        }
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
    private isSubTableFrontierCell(headerRow: number, subTableDef: CellDef) {
        const { line, column, row } = this
        const grammar = subTableDef.headerCellDef!.grammar
        const isToTheImmediateRightOfLastFullCell =
            line && trimArray(line).length === column
        return (
            row === headerRow &&
            !isBlankLine(line) &&
            isToTheImmediateRightOfLastFullCell &&
            grammar &&
            Object.keys(grammar).length
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

    private get definitionLinks(): CellPosition[] {
        return []
    }

    private get implementationLinks(): CellPosition[] {
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
        const { cellDef, value, optionKeywords } = this
        const { regex, requirements, catchAllKeyword } = cellDef
        const catchAllKeywordRegex = catchAllKeyword?.regex

        if (value === undefined || value === "") return ""

        const regexResult = regex
            ? validate(value, regex, requirements)
            : undefined
        const catchAllRegexResult = catchAllKeywordRegex
            ? validate(
                  value,
                  catchAllKeywordRegex,
                  catchAllKeyword!.requirements
              )
            : undefined

        if (optionKeywords) {
            if (optionKeywords.includes(value)) return ""

            if (regex) return regexResult
            if (catchAllKeywordRegex) return catchAllRegexResult

            const guess = didYouMean(value, optionKeywords)
            if (guess) return `Did you mean '${guess}'?`

            return `Error: '${value}' is not a valid option. Valid options are ${optionKeywords
                .map((opt) => `'${opt}'`)
                .join(", ")}`
        }

        if (regex) return regexResult
        if (catchAllKeywordRegex) return catchAllRegexResult

        return ""
    }

    get value() {
        return this.line ? this.line[this.column] : undefined
    }

    get comment() {
        const { value, errorMessage, cellDef } = this
        if (isEmpty(value)) return undefined
        if (errorMessage) return errorMessage

        if (cellDef.grammar) {
            const def = cellDef.grammar[value!] ?? cellDef.catchAllKeyword
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
            this.cellDef.keyword === "table" ? "HasSuggestions" : null // todo: switch from strings to constants
        return [cellDef.cssClass, hasSuggestions, showArrow].filter(isPresent)
    }

    get placeholder() {
        const { value, cellDef } = this
        const { terminalOptions } = cellDef
        const firstOption = terminalOptions && terminalOptions[0]
        const firstOptionName = firstOption && firstOption.keyword
        const placeholder = cellDef.placeholder ?? firstOptionName
        return isEmpty(value) && placeholder ? `eg "${placeholder}"` : undefined
    }

    get optionKeywords() {
        const { cellDef } = this
        const { grammar, headerCellDef, terminalOptions } = cellDef
        return terminalOptions
            ? terminalOptions.map((def) => def.keyword)
            : grammar
            ? Object.keys(grammar)
            : headerCellDef
            ? Object.keys(headerCellDef.grammar!)
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
