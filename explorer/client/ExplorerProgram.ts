import {
    trimGrid,
    detectDelimiter,
    uniq,
    parseDelimited,
    isCellEmpty,
    isPresent,
} from "grapher/utils/Util"
import {
    queryParamsToStr,
    strToQueryParams,
    QueryParams,
} from "utils/client/url"
import { action, observable, computed } from "mobx"
import { SubNavId } from "site/server/views/SiteSubnavigation"
import { ObservableUrl } from "grapher/utils/UrlBinder"
import { ExplorerControlType, ExplorerControlOption } from "./ExplorerConstants"

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
    isPublished = "isPublished",
    title = "title",
    subNavId = "subNavId",
    subNavCurrentId = "subNavCurrentId",
    thumbnail = "thumbnail",
    subtitle = "subtitle",
    defaultView = "defaultView",
    wpBlockId = "wpBlockId",
}

export class ExplorerProgram {
    constructor(slug: string, tsv: string, queryString: string = "") {
        this.lines = tsv.replace(/\r/g, "").split(this.nodeDelimiter)
        this.slug = slug
        queryString = queryString ? queryString : this.defaultView || ""
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

    static defaultExplorerProgram = `${ProgramKeyword.title}\tData Explorer
${ProgramKeyword.isPublished}\tfalse
${ProgramKeyword.switcher}
\tchartId\tDevice
\t35\tInternet
\t46\tMobile`

    private getLineValue(keyword: string) {
        const line = this.lines.find((line) =>
            line.startsWith(keyword + this.cellDelimiter)
        )
        return line ? line.split(this.cellDelimiter)[1] : undefined
    }

    getLineIndex(key: ProgramKeyword) {
        return this.lines.findIndex(
            (line) => line.startsWith(key + this.cellDelimiter) || line === key
        )
    }

    private setLineValue(key: ProgramKeyword, value: string | undefined) {
        const index = this.getLineIndex(key)
        const newLine = key + this.cellDelimiter + value
        if (index === -1 && value !== undefined) this.lines.push(newLine)
        else if (value === undefined) this.lines = this.lines.splice(index, 1)
        else this.lines[index] = newLine
    }

    private getBlock(key: ProgramKeyword) {
        const ends = this.getBlockEnds(key)
        if (!ends) return undefined
        return this.lines
            .slice(ends.start, ends.end)
            .map((line) => line.substr(1))
            .join(this.nodeDelimiter)
    }

    get requiredChartIds() {
        return SwitcherRuntime.getRequiredChartIds(this.switcherCode || "")
    }

    static fromArrays(slug: string, table: any[][]) {
        const str = table
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
        return trimGrid(this.toArrays())
            .map((line) => line.join(this.cellDelimiter))
            .join(this.nodeDelimiter)
    }

    private getBlockEnds(key: ProgramKeyword) {
        const keyLine = this.getLineIndex(key)
        if (keyLine === -1) return undefined
        const blockStart = keyLine + 1
        let length = this.lines
            .slice(blockStart)
            .findIndex((line) => !line.startsWith(this.edgeDelimiter))
        if (length === -1) length = this.lines.slice(blockStart).length
        return { start: blockStart, end: blockStart + length, length }
    }

    private setBlock(key: ProgramKeyword, value: string | undefined) {
        if (!value) return this.deleteBlock(key)

        const ends = this.getBlockEnds(key)
        if (!ends) return this.appendBlock(key, value)

        this.lines = this.lines.splice(
            ends.start,
            ends.length,
            key,
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

    private deleteBlock(key: ProgramKeyword) {
        const ends = this.getBlockEnds(key)
        if (!ends) return

        this.lines = this.lines.splice(ends.start, ends.length)
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
        return this.getBlock(ProgramKeyword.switcher)
    }
}

// todo: cleanup
const makeControlTypesMap = (delimited: string) => {
    const headerLine = delimited.split("\n")[0]
    const map = new Map<ChoiceName, ExplorerControlType>()
    headerLine
        .split(detectDelimiter(headerLine))
        .filter((name) => name !== CHART_ID_SYMBOL)
        .forEach((choiceName) => {
            const words = choiceName.split(" ")
            const type = words.pop() as ExplorerControlType
            if (ExplorerControlType[type]) map.set(words.join(" "), type)
            else map.set(choiceName, ExplorerControlType.Radio)
        })
    return map
}

// todo: cleanup
// This strips the "Dropdown" or "Checkbox" from "SomeChoice Dropdown" or "SomeChoice Checkbox"
const removeChoiceControlTypeInfo = (str: string) => {
    const lines = str.split("\n")
    const headerLine = lines[0]
    const delimiter = detectDelimiter(headerLine)
    const types = Object.values(ExplorerControlType).join("|")
    const reg = new RegExp(" (" + types + ")$")
    lines[0] = headerLine
        .split(delimiter)
        .map((cell) => cell.replace(reg, ""))
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
    private rows: any[]
    @observable private _settings: SwitcherQuery = {}
    constructor(delimited: string, queryString: string = "") {
        this.choiceControlTypes = makeControlTypesMap(delimited)
        delimited = removeChoiceControlTypeInfo(delimited)
        this.rows = parseDelimited(delimited)
        this.rows.forEach((row) => {
            row.chartId = parseInt(row.chartId)
        })
        this.setValuesFromQueryString(queryString)
    }

    allOptionsAsQueryStrings() {
        return this.rows.map((row) => {
            const params: QueryParams = {}
            this.choiceNames.forEach((name) => {
                params[name] = row[name]
            })
            return queryParamsToStr(params)
        })
    }

    private choiceControlTypes: Map<string, ExplorerControlType>

    toObject(): SwitcherQuery {
        return { ...this._settings }
    }

    @computed get params(): QueryParams {
        return this.toObject()
    }

    static getRequiredChartIds(code: string) {
        return parseDelimited(code)
            .map((row) => parseInt(row.chartId!))
            .filter((id) => !isNaN(id))
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
        const firstRow = this.rows[0]
        if (!firstRow) return []
        return Object.keys(firstRow).filter((name) => name !== CHART_ID_SYMBOL)
    }

    @computed private get allChoiceOptions(): ChoiceMap {
        const choiceMap: ChoiceMap = {}
        this.choiceNames.forEach((choiceName) => {
            choiceMap[choiceName] = uniq(
                this.rows.map((row) => row[choiceName])
            ).filter((cell) => !isCellEmpty(cell)) as string[]
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

    isOptionAvailable(choiceName: ChoiceName, optionName: string) {
        const query: SwitcherQuery = {}
        const columnNames = this.choiceNames
        columnNames.slice(0, columnNames.indexOf(choiceName)).forEach((col) => {
            query[col] = this._settings[col]
        })
        query[choiceName] = optionName
        return this.rowsWith(query, choiceName).length > 0
    }

    private rowIndexesWith(query: SwitcherQuery, choiceName?: ChoiceName) {
        return this.rows
            .map((row, rowIndex) =>
                Object.keys(query)
                    .filter((key) => query[key] !== undefined)
                    .every(
                        (key) =>
                            row[key] === query[key] ||
                            (choiceName && choiceName !== key
                                ? isCellEmpty(row[key])
                                : false)
                    )
                    ? rowIndex
                    : null
            )
            .filter(isPresent)
    }

    private rowsWith(query: SwitcherQuery, choiceName?: ChoiceName) {
        return this.rowIndexesWith(query, choiceName).map(
            (index) => this.rows[index]
        )
    }

    @computed get chartId(): number {
        const row = this.rowsWith(this.toConstrainedOptions())[0]
        return row?.chartId
    }

    @computed get selectedRowIndex(): number {
        return this.rowIndexesWith(this.toConstrainedOptions())[0]
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
