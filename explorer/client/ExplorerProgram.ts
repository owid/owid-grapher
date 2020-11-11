import { isPresent, trimObject } from "grapher/utils/Util"
import {
    queryParamsToStr,
    strToQueryParams,
    QueryParams,
} from "utils/client/url"
import { action, observable, computed } from "mobx"
import { SubNavId } from "site/server/views/SiteSubnavigation"
import { ObjectThatSerializesToQueryParams } from "grapher/utils/UrlBinder"
import {
    ExplorerControlType,
    ExplorerControlOption,
    ExplorerControlTypeRegex,
    DefaultNewExplorerSlug,
} from "./ExplorerConstants"
import { CoreTable } from "coreTable/CoreTable"
import { CoreMatrix } from "coreTable/CoreTableConstants"
import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import {
    trimMatrix,
    detectDelimiter,
    parseDelimited,
    isCellEmpty,
} from "coreTable/CoreTableUtils"
import { getRequiredChartIds } from "./ExplorerUtils"
import { ExplorerGrammar, ExplorerKeywords } from "./ExplorerGrammar"
import { GridCell } from "./GridCell"
import { GridBoolean, ParsedCell } from "./GridGrammarConstants"

const CHART_ID_SYMBOL = "chartId"

interface Choice {
    title: string
    options: ExplorerControlOption[]
    value: string
    type: ExplorerControlType
}

export const EXPLORER_FILE_SUFFIX = ".explorer.tsv"

const nodeDelimiter = "\n"
const cellDelimiter = "\t"
const edgeDelimiter = "\t"

interface BlockLocation {
    start: number
    end: number
    length: number
}

export interface TableDef {
    url?: string
    columnDefinitions?: string
    inlineData?: string
}

export interface SerializedExplorerProgram {
    slug: string
    program: string
    lastModifiedTime?: number
    shortHash?: string
}

export class ExplorerProgram {
    constructor(
        slug: string,
        tsv: string,
        lastModifiedTime?: number,
        shortHash?: string
    ) {
        this.lines = tsv.replace(/\r/g, "").split(this.nodeDelimiter)
        this.slug = slug
        this.decisionMatrix = new DecisionMatrix(
            this.decisionMatrixCode ?? "",
            shortHash
        )
        this.lastModifiedTime = lastModifiedTime
        this.shortHash = shortHash
    }

    shortHash?: string
    lastModifiedTime?: number
    slug: string
    decisionMatrix: DecisionMatrix

    toJson(): SerializedExplorerProgram {
        return {
            program: this.toString(),
            slug: this.slug,
            lastModifiedTime: this.lastModifiedTime,
            shortHash: this.shortHash,
        }
    }

    get isNewFile() {
        return this.slug === DefaultNewExplorerSlug
    }

    static fromJson(json: SerializedExplorerProgram) {
        return new ExplorerProgram(
            json.slug,
            json.program,
            json.lastModifiedTime,
            json.shortHash
        )
    }

    get filename() {
        return this.slug + EXPLORER_FILE_SUFFIX
    }

    static fullPath(slug: string) {
        return `explorers/${slug}${EXPLORER_FILE_SUFFIX}`
    }

    get fullPath() {
        return ExplorerProgram.fullPath(this.slug)
    }

    private nodeDelimiter = nodeDelimiter
    cellDelimiter = cellDelimiter
    private edgeDelimiter = edgeDelimiter
    lines: string[]

    private getLineValue(keyword: string) {
        const line = this.lines.find((line) =>
            line.startsWith(keyword + this.cellDelimiter)
        )
        return line ? line.split(this.cellDelimiter)[1] : undefined
    }

    getKeywordIndex(key: string) {
        return this.lines.findIndex(
            (line) => line.startsWith(key + this.cellDelimiter) || line === key
        )
    }

    getKeywordIndexes(words: string[]) {
        const key = words.join(this.cellDelimiter)
        return this.lines
            .map((line, index) =>
                line.startsWith(key + this.cellDelimiter) || line === key
                    ? index
                    : null
            )
            .filter(isPresent)
    }

    getCell(row: number, col: number): ParsedCell {
        return new GridCell(this.matrix, row, col, ExplorerGrammar)
        // todo: implement cacheing for perf
        // const line = this.parsedCells[row]
        // return line ? line[col] ?? {} : {}
    }

    @computed private get parsedCells() {
        return this.matrix.map((line, lineIndex) =>
            line.map(
                (cell, cellIndex) =>
                    new GridCell(
                        this.matrix,
                        lineIndex,
                        cellIndex,
                        ExplorerGrammar
                    )
            )
        )
    }

    @computed private get matrix() {
        return this.lines.map((line) => line.split(this.cellDelimiter))
    }

    private setLineValue(key: string, value: string | undefined) {
        const index = this.getKeywordIndex(key)
        const newLine = `${key}${this.cellDelimiter}${value}`
        if (index === -1 && value !== undefined) this.lines.push(newLine)
        else if (value === undefined) this.lines = this.lines.splice(index, 1)
        else this.lines[index] = newLine
    }

    private getBlock(keywordIndex: number) {
        const location = this.getBlockLocation(keywordIndex)
        return this.lines
            .slice(location.start, location.end)
            .map((line) => line.substr(1))
            .join(this.nodeDelimiter)
    }

    get requiredChartIds() {
        return getRequiredChartIds(this.decisionMatrixCode ?? "")
    }

    static fromMatrix(slug: string, matrix: CoreMatrix) {
        const str = matrix
            .map((row) => row.join(cellDelimiter))
            .join(nodeDelimiter)
        return new ExplorerProgram(slug, str)
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

    private prettify() {
        return trimMatrix(this.toArrays())
            .map((line) => line.join(this.cellDelimiter))
            .join(this.nodeDelimiter)
    }

    private getBlockLocation(blockStartLine: number): BlockLocation {
        const blockStart = blockStartLine + 1
        let length = this.lines
            .slice(blockStart)
            .findIndex((line) => line && !line.startsWith(this.edgeDelimiter))
        if (length === -1) length = this.lines.slice(blockStart).length
        return { start: blockStart, end: blockStart + length, length }
    }

    get title() {
        return this.getLineValue(ExplorerKeywords.title.keyword)
    }

    get subNavId(): SubNavId | undefined {
        return this.getLineValue(ExplorerKeywords.subNavId.keyword) as SubNavId
    }

    get googleSheet() {
        return this.getLineValue(ExplorerKeywords.googleSheet.keyword)
    }

    get hideAlertBanner() {
        return (
            this.getLineValue(ExplorerKeywords.hideAlertBanner.keyword) ===
            GridBoolean.true
        )
    }

    get subNavCurrentId() {
        return this.getLineValue(ExplorerKeywords.subNavCurrentId.keyword)
    }

    get thumbnail() {
        return this.getLineValue(ExplorerKeywords.thumbnail.keyword)
    }

    get subtitle() {
        return this.getLineValue(ExplorerKeywords.subtitle.keyword)
    }

    get entityType() {
        return this.getLineValue(ExplorerKeywords.entityType.keyword)
    }

    get defaultView() {
        return this.getLineValue(ExplorerKeywords.defaultView.keyword)
    }

    get hideControls() {
        return this.getLineValue(ExplorerKeywords.hideControls.keyword)
    }

    get isPublished() {
        return (
            this.getLineValue(ExplorerKeywords.isPublished.keyword) ===
            GridBoolean.true
        )
    }

    set isPublished(value: boolean) {
        this.setLineValue(
            ExplorerKeywords.isPublished.keyword,
            value ? GridBoolean.true : GridBoolean.false
        )
    }

    get wpBlockId() {
        const blockIdString = this.getLineValue(
            ExplorerKeywords.wpBlockId.keyword
        )
        return blockIdString ? parseInt(blockIdString, 10) : undefined
    }

    get decisionMatrixCode() {
        const keywordIndex = this.getKeywordIndex(
            ExplorerKeywords.switcher.keyword
        )
        if (keywordIndex === -1) return undefined
        return this.getBlock(keywordIndex)
    }

    getTableDef(tableSlug: string): TableDef | undefined {
        const matchingTableIndex = this.getKeywordIndexes([
            ExplorerKeywords.table.keyword,
            tableSlug,
        ])[0]
        if (matchingTableIndex === undefined) return undefined

        const matchingColumnsIndex = this.getKeywordIndexes([
            ExplorerKeywords.columns.keyword,
            tableSlug,
        ])[0]
        return {
            url: this.lines[matchingTableIndex].split(this.cellDelimiter)[2],
            columnDefinitions: matchingColumnsIndex
                ? this.getBlock(matchingColumnsIndex)
                : undefined,
            inlineData: this.getBlock(matchingTableIndex),
        }
    }
}

// todo: cleanup
const makeControlTypesMap = (delimited: string) => {
    const headerLine = delimited.split("\n")[0]
    const map = new Map<ChoiceName, ExplorerControlType>()
    headerLine
        .split(detectDelimiter(headerLine))
        .filter((name) => ExplorerControlTypeRegex.test(name))
        .forEach((choiceName) => {
            const words = choiceName.split(" ")
            const type = words.pop() as ExplorerControlType
            map.set(words.join(" "), type)
        })
    return map
}

// todo: cleanup
// This strips the "Dropdown" or "Checkbox" from "SomeChoice Dropdown" or "SomeChoice Checkbox"
const removeChoiceControlTypeInfo = (str: string) => {
    const lines = str.split("\n")
    const headerLine = lines[0]
    const delimiter = detectDelimiter(headerLine)
    lines[0] = headerLine
        .split(delimiter)
        .map((cell) => cell.replace(ExplorerControlTypeRegex, ""))
        .join(delimiter)
    return lines.join("\n")
}

type ChoiceName = string
type ChoiceValue = string

// A "query" here is just a map of choice names and values. Maps nicely to a query string.
interface DecisionMatrixQueryParams extends QueryParams {
    [choiceName: string]: ChoiceValue
}

interface ChoiceMap {
    [choiceName: string]: ChoiceValue[]
}

// Takes the author's program and the user's current settings and returns an object for
// allow the user to navigate amongst charts.
export class DecisionMatrix implements ObjectThatSerializesToQueryParams {
    private table: CoreTable
    @observable private _settings: DecisionMatrixQueryParams = {}
    constructor(delimited: string, shortHash = "") {
        this.choiceControlTypes = makeControlTypesMap(delimited)
        delimited = removeChoiceControlTypeInfo(delimited)
        this.table = new CoreTable(parseDelimited(delimited), [
            { slug: CHART_ID_SYMBOL, type: ColumnTypeNames.Integer },
        ])
        this.shortHash = shortHash
        this.setValuesFromQueryString() // Initialize options
    }

    allOptionsAsQueryStrings() {
        return this.table.rows.map((row) => {
            const params: DecisionMatrixQueryParams = {}
            this.choiceNames.forEach((name) => {
                params[name] = row[name]
            })
            return queryParamsToStr(params)
        })
    }

    private choiceControlTypes: Map<ChoiceName, ExplorerControlType>
    private shortHash: string

    toObject(): DecisionMatrixQueryParams {
        return { ...this._settings }
    }

    @computed get params(): DecisionMatrixQueryParams {
        return { ...this.toObject(), shortHash: this.shortHash }
    }

    toConstrainedOptions() {
        const settings = this.toObject()
        this.choiceNames.forEach((choiceName) => {
            if (!this.isOptionAvailable(choiceName, settings[choiceName]))
                settings[choiceName] = this.firstAvailableOptionForChoice(
                    choiceName
                )!
        })
        return settings
    }

    @action.bound setValue(choiceName: ChoiceName, value: ChoiceValue) {
        if (value === "") delete this._settings[choiceName]
        else this._settings[choiceName] = value
    }

    @action.bound setValuesFromQueryString(queryString = "") {
        const queryParams = strToQueryParams(
            decodeURIComponent(queryString)
        ) as DecisionMatrixQueryParams
        this.choiceNames.forEach((choiceName) => {
            if (queryParams[choiceName] === undefined)
                this.setValue(
                    choiceName,
                    this.firstAvailableOptionForChoice(choiceName)!
                )
            else this.setValue(choiceName, queryParams[choiceName]!)
        })
        return this
    }

    @computed private get choiceNames(): ChoiceName[] {
        return Array.from(this.choiceControlTypes.keys())
    }

    @computed private get allChoiceOptions(): ChoiceMap {
        const choiceMap: ChoiceMap = {}
        this.choiceNames.forEach((choiceName) => {
            choiceMap[choiceName] = this.table
                .get(choiceName)
                .uniqValues.filter((cell) => !isCellEmpty(cell)) as string[]
        })
        return choiceMap
    }

    private firstAvailableOptionForChoice(
        choiceName: ChoiceName
    ): ChoiceValue | undefined {
        return this.allChoiceOptions[choiceName].find((option) =>
            this.isOptionAvailable(choiceName, option)
        )
    }

    isOptionAvailable(choiceName: ChoiceName, option: ChoiceValue) {
        const query: DecisionMatrixQueryParams = {}
        this.choiceNames
            .slice(0, this.choiceNames.indexOf(choiceName))
            .forEach((name) => {
                query[name] = this._settings[name]
            })
        query[choiceName] = option
        return this.rowsWith(query, choiceName).length > 0
    }

    private rowsWith(
        query: DecisionMatrixQueryParams,
        choiceName?: ChoiceName
    ) {
        // We allow other options to be blank.
        const modifiedQuery: any = {}
        Object.keys(trimObject(query)).forEach((queryColumn) => {
            if (queryColumn !== choiceName)
                // Blanks are fine if we are not talking about the column of interest
                modifiedQuery[queryColumn] = [query[queryColumn], ""]
            else modifiedQuery[queryColumn] = query[queryColumn]
        })
        return this.table.findRows(modifiedQuery)
    }

    @computed private get firstMatch() {
        return this.rowsWith(this.toConstrainedOptions())[0]
    }

    @computed get selectedRowIndex() {
        return this.firstMatch === undefined
            ? 0
            : this.table.indexOf(this.firstMatch)
    }

    @computed get selectedRow() {
        return this.table.rowsAt([this.selectedRowIndex])[0]
    }

    private toControlOption(
        choiceName: ChoiceName,
        optionName: string,
        value: ChoiceValue
    ): ExplorerControlOption {
        return {
            label: optionName,
            checked: value === optionName,
            value: optionName,
            available: this.isOptionAvailable(choiceName, optionName),
        }
    }

    @computed get choicesWithAvailability(): Choice[] {
        const constrainedOptions = this.toConstrainedOptions()
        return this.choiceNames.map((title) => {
            const value = constrainedOptions[title]
            const options = this.allChoiceOptions[title].map((optionName) =>
                this.toControlOption(title, optionName, value)
            )
            const type = this.choiceControlTypes.get(title)!

            return {
                title,
                type,
                value,
                options:
                    type === ExplorerControlType.Checkbox
                        ? makeCheckBoxOptions(options, title)
                        : options,
            }
        })
    }

    toString() {
        return queryParamsToStr(this._settings)
    }
}

const makeCheckBoxOptions = (
    options: ExplorerControlOption[],
    choiceName: string
) => {
    const checked = options.find(
        (option) => option.checked === true && option.label === GridBoolean.true
    )
    return [
        {
            label: choiceName,
            checked,
            value: GridBoolean.true,
            available: options.length > 1,
        },
    ] as ExplorerControlOption[]
}
