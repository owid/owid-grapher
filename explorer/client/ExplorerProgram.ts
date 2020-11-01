import { isPresent, trimObject } from "grapher/utils/Util"
import {
    queryParamsToStr,
    strToQueryParams,
    QueryParams,
} from "utils/client/url"
import { action, observable, computed } from "mobx"
import { SubNavId } from "site/server/views/SiteSubnavigation"
import { ObservableUrl } from "grapher/utils/UrlBinder"
import {
    ExplorerControlType,
    ExplorerControlOption,
    ExplorerControlTypeRegex,
} from "./ExplorerConstants"
import { CoreTable } from "coreTable/CoreTable"
import { ColumnTypeNames, CoreMatrix } from "coreTable/CoreTableConstants"
import {
    trimMatrix,
    detectDelimiter,
    parseDelimited,
    isCellEmpty,
} from "coreTable/CoreTableUtils"
import { getRequiredChartIds } from "./ExplorerUtils"

const CHART_ID_SYMBOL = "chartId"
const FALSE_SYMBOL = "FALSE"

interface Choice {
    title: string
    options: ExplorerControlOption[]
    value: string
    type: ExplorerControlType
}

export const explorerFileSuffix = ".explorer.tsv"

const nodeDelimiter = "\n"
const cellDelimiter = "\t"
const edgeDelimiter = "\t"

export enum ProgramKeyword {
    switcher = "switcher",
    table = "table",
    isPublished = "isPublished",
    title = "title",
    subNavId = "subNavId",
    subNavCurrentId = "subNavCurrentId",
    thumbnail = "thumbnail",
    subtitle = "subtitle",
    defaultView = "defaultView",
    wpBlockId = "wpBlockId",
}

export const DefaultExplorerProgram = `${ProgramKeyword.title}\tData Explorer
${ProgramKeyword.isPublished}\tfalse
${ProgramKeyword.switcher}
\t${CHART_ID_SYMBOL}\tDevice Radio
\t35\tInternet
\t46\tMobile`

interface BlockLocation {
    start: number
    end: number
    length: number
}

export class ExplorerProgram {
    constructor(slug: string, tsv: string, queryString = "") {
        this.lines = tsv.replace(/\r/g, "").split(this.nodeDelimiter)
        this.slug = slug
        queryString = (queryString ? queryString : this.defaultView) ?? ""
        this.switcherRuntime = new SwitcherRuntime(
            this.switcherCode || "",
            queryString
        )
        this.queryString = queryString
    }

    slug: string
    queryString: string
    switcherRuntime: SwitcherRuntime

    get filename() {
        return this.slug + explorerFileSuffix
    }

    static fullPath(slug: string) {
        return `explorers/${slug}${explorerFileSuffix}`
    }

    get fullPath() {
        return ExplorerProgram.fullPath(this.slug)
    }

    private nodeDelimiter = nodeDelimiter
    private cellDelimiter = cellDelimiter
    private edgeDelimiter = edgeDelimiter
    private lines: string[]

    private getLineValue(keyword: string) {
        const line = this.lines.find((line) =>
            line.startsWith(keyword + this.cellDelimiter)
        )
        return line ? line.split(this.cellDelimiter)[1] : undefined
    }

    getKeywordIndex(key: ProgramKeyword) {
        return this.lines.findIndex(
            (line) => line.startsWith(key + this.cellDelimiter) || line === key
        )
    }

    getKeywordIndexes(key: ProgramKeyword) {
        return this.lines
            .map((line, index) =>
                line.startsWith(key + this.cellDelimiter) || line === key
                    ? index
                    : null
            )
            .filter(isPresent)
    }

    private setLineValue(key: ProgramKeyword, value: string | undefined) {
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
        return getRequiredChartIds(this.switcherCode ?? "")
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

    private setBlock(keyword: ProgramKeyword, value: string | undefined) {
        if (!value) return this.deleteBlock(keyword)

        const keywordIndex = this.getKeywordIndex(keyword)
        if (keywordIndex === -1) return this.appendBlock(keyword, value)
        const location = this.getBlockLocation(keywordIndex)

        this.lines = this.lines.splice(
            location.start,
            location.length,
            keyword,
            ...value
                .split(this.nodeDelimiter)
                .map((line) => this.edgeDelimiter + line)
        )
    }

    private appendBlock(key: string, value: string) {
        this.lines.push(key)
        value
            .split(this.nodeDelimiter)
            .forEach((line) => this.lines.push(this.edgeDelimiter + line))
    }

    private deleteBlock(keyword: ProgramKeyword) {
        const keywordIndex = this.getKeywordIndex(keyword)
        if (keywordIndex === -1) return
        const location = this.getBlockLocation(keywordIndex)
        this.lines = this.lines.splice(location.start, location.length)
    }

    get title(): string | undefined {
        return this.getLineValue(ProgramKeyword.title)
    }

    get subNavId(): SubNavId | undefined {
        return this.getLineValue(ProgramKeyword.subNavId) as SubNavId
    }

    get subNavCurrentId(): string | undefined {
        return this.getLineValue(ProgramKeyword.subNavCurrentId)
    }

    get thumbnail(): string | undefined {
        return this.getLineValue(ProgramKeyword.thumbnail)
    }

    get subtitle(): string | undefined {
        return this.getLineValue(ProgramKeyword.subtitle)
    }

    get defaultView(): string | undefined {
        // Todo: to help authors, at least do a console log if defaultView is malformed (has invalid param names, for example).
        return this.getLineValue(ProgramKeyword.defaultView)
    }

    get isPublished() {
        return this.getLineValue(ProgramKeyword.isPublished) === "true"
    }

    set isPublished(value: boolean) {
        this.setLineValue(ProgramKeyword.isPublished, value ? "true" : "false")
    }

    get wpBlockId(): number | undefined {
        const blockIdString = this.getLineValue(ProgramKeyword.wpBlockId)
        return blockIdString ? parseInt(blockIdString, 10) : undefined
    }

    get switcherCode() {
        const keywordIndex = this.getKeywordIndex(ProgramKeyword.switcher)
        if (keywordIndex === -1) return undefined
        return this.getBlock(keywordIndex)
    }

    getTableCode(tableSlug: string) {
        const keywordIndexes = this.getKeywordIndexes(ProgramKeyword.table)
        const matchingTableIndex = keywordIndexes.find((index) =>
            this.lines[index].startsWith(
                [ProgramKeyword.table, tableSlug].join(this.cellDelimiter)
            )
        )
        if (matchingTableIndex === undefined) return undefined
        return this.getBlock(matchingTableIndex)
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
interface SwitcherQuery {
    [choiceName: string]: ChoiceValue
}

interface ChoiceMap {
    [choiceName: string]: ChoiceValue[]
}

// Takes the author's program and the user's current settings and returns an object for
// allow the user to navigate amongst charts.
export class SwitcherRuntime implements ObservableUrl {
    private table: CoreTable
    @observable private _settings: SwitcherQuery = {}
    constructor(delimited: string, queryString: string = "") {
        this.choiceControlTypes = makeControlTypesMap(delimited)
        delimited = removeChoiceControlTypeInfo(delimited)
        this.table = new CoreTable(parseDelimited(delimited), [
            { slug: CHART_ID_SYMBOL, type: ColumnTypeNames.Integer },
        ])
        this.setValuesFromQueryString(queryString)
    }

    allOptionsAsQueryStrings() {
        return this.table.rows.map((row) => {
            const params: QueryParams = {}
            this.choiceNames.forEach((name) => {
                params[name] = row[name]
            })
            return queryParamsToStr(params)
        })
    }

    private choiceControlTypes: Map<ChoiceName, ExplorerControlType>

    toObject(): SwitcherQuery {
        return { ...this._settings }
    }

    @computed get params(): QueryParams {
        return this.toObject()
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
        this._settings[choiceName] = value
    }

    @action.bound setValuesFromQueryString(queryString: string) {
        const queryParams = strToQueryParams(decodeURIComponent(queryString))
        this.choiceNames.forEach((choiceName) => {
            if (queryParams[choiceName] === undefined)
                this.setValue(
                    choiceName,
                    this.firstAvailableOptionForChoice(choiceName)!
                )
            else this.setValue(choiceName, queryParams[choiceName]!)
        })
    }

    @computed private get choiceNames(): ChoiceName[] {
        return Array.from(this.choiceControlTypes.keys())
    }

    @computed private get allChoiceOptions(): ChoiceMap {
        const choiceMap: ChoiceMap = {}
        this.choiceNames.forEach((choiceName) => {
            choiceMap[choiceName] = this.table
                .get(choiceName)!
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
        const query: SwitcherQuery = {}
        this.choiceNames
            .slice(0, this.choiceNames.indexOf(choiceName))
            .forEach((name) => {
                query[name] = this._settings[name]
            })
        query[choiceName] = option
        return this.rowsWith(query, choiceName).length > 0
    }

    private rowsWith(query: SwitcherQuery, choiceName?: ChoiceName) {
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
            let options = this.allChoiceOptions[title].map((optionName) =>
                this.toControlOption(title, optionName, value)
            )
            const type = this.choiceControlTypes.get(title)!
            if (type === ExplorerControlType.Checkbox)
                options = options.filter((opt) => opt.label !== FALSE_SYMBOL)

            return {
                title,
                type,
                value,
                options,
            }
        })
    }

    toString() {
        return queryParamsToStr(this._settings)
    }
}
