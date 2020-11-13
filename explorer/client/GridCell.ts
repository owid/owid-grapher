import { imemo } from "coreTable/CoreTableUtils"
import { isPresent } from "grapher/utils/Util"
import { didYouMean, isBlankLine, isEmpty } from "./GrammarUtils"
import {
    CellCoordinate,
    CellLink,
    CellTypeDefinition,
    ErrorCellTypeClass,
    MatrixLine,
    MatrixProgram,
    KeywordMap,
    FrontierCellClass,
    ParsedCell,
    AbstractTypeDefinitions,
} from "./GridGrammarConstants"

export class GridCell implements ParsedCell {
    private row: CellCoordinate
    private column: CellCoordinate
    private matrix: MatrixProgram
    private rootDefinition: CellTypeDefinition
    constructor(
        matrix: MatrixProgram,
        row: CellCoordinate,
        column: CellCoordinate,
        rootDefinition: CellTypeDefinition
    ) {
        this.row = row
        this.column = column
        this.matrix = matrix
        this.rootDefinition = rootDefinition
    }

    private get value() {
        return this.line ? this.line[this.column] : undefined
    }

    private get line(): MatrixLine | undefined {
        return this.matrix[this.row]
    }

    private get cellTerminalTypeDefinition(): CellTypeDefinition | undefined {
        const { rootDefinition } = this
        const keywordMap = (rootDefinition.keywordMap as unknown) as KeywordMap
        if (this.column === 0)
            return (rootDefinition as unknown) as CellTypeDefinition
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
        return AbstractTypeDefinitions.nothingGoesThere
    }

    @imemo private get cellTypeDefinition(): CellTypeDefinition {
        const def = this.cellTerminalTypeDefinition
        if (def) return def

        const subTable = this.subTableInfo
        if (subTable) return (subTable.def as unknown) as CellTypeDefinition

        return AbstractTypeDefinitions.wip
    }

    @imemo private get subTableInfo() {
        if (this.cellTerminalTypeDefinition) return undefined

        let start = this.row
        while (start) {
            const parentLine = this.matrix[start - 1]
            if (!parentLine) return undefined
            const parentKeyword = parentLine[0]
            if (parentKeyword) {
                const subTableDef = (this.rootDefinition.keywordMap as any)[
                    parentKeyword
                ] as CellTypeDefinition
                if (!subTableDef || !subTableDef.headerKeyword) return undefined
                const isHeaderRow = this.row === start && this.value
                return {
                    isHeaderRow,
                    def: isHeaderRow
                        ? subTableDef.headerKeyword ??
                          AbstractTypeDefinitions.subtableHeaderWord
                        : AbstractTypeDefinitions.subtableWord,
                }
            }
            start--
        }
        return undefined
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

    // If true show a +
    // todo: not actually getting called by HOT.
    private get isSubTableFrontierCell() {
        const { subTableInfo, line, value, column } = this
        if (!line || !isEmpty(value) || !subTableInfo) return false
        if (column === 1) return true
        return !isEmpty(line[column - 1]) && isEmpty(line[column + 1])
    }

    get errorMessage() {
        if (!this.line) return ""
        const { cellTypeDefinition, value, options } = this
        const { regex, requirements, catchAllKeyword } = cellTypeDefinition
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

    get comment() {
        const { value, errorMessage, cellTypeDefinition } = this
        if (isEmpty(value)) return undefined
        if (errorMessage) return errorMessage

        if (cellTypeDefinition.keywordMap) {
            const def =
                cellTypeDefinition.keywordMap[value!] ??
                cellTypeDefinition.catchAllKeyword
            return def.description
        }

        return [cellTypeDefinition.description].join("\n")
    }

    get cssClasses() {
        const { errorMessage, cellTypeDefinition } = this
        if (errorMessage) return [ErrorCellTypeClass]
        const showArrow =
            this.isFirstCellOnFrontierRow || this.isSubTableFrontierCell
                ? FrontierCellClass
                : undefined
        return [cellTypeDefinition.cssClass, showArrow].filter(isPresent)
    }

    get options() {
        const { cellTypeDefinition } = this
        const { keywordMap, headerKeyword } = cellTypeDefinition
        return keywordMap
            ? Object.keys(keywordMap)
            : headerKeyword
            ? Object.keys(headerKeyword.keywordMap!)
            : cellTypeDefinition.options
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
