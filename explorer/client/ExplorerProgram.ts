import {
    trimGrid,
    detectDelimiter,
    uniq,
    parseDelimited,
    isCellEmpty,
} from "grapher/utils/Util"
import {
    queryParamsToStr,
    strToQueryParams,
    QueryParams,
} from "utils/client/url"
import { ControlOption, DropdownOption } from "explorer/client/ExplorerControls"
import { action, observable, computed } from "mobx"
import { SubNavId } from "site/server/views/SiteSubnavigation"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"

const CHART_ID_SYMBOL = "chartId"
const FALSE_SYMBOL = "FALSE"

interface Group {
    title: string
    options: ControlOption[]
    dropdownOptions?: DropdownOption[]
    value: string
    isCheckbox: boolean
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
        this.explorerRuntime = new ExplorerQueryParams(queryString)
        this.queryString = queryString
    }

    slug: string
    queryString: string
    switcherRuntime: SwitcherRuntime
    explorerRuntime: ExplorerQueryParams

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

enum ControlType {
    Radio = "Radio",
    Checkbox = "Checkbox",
    Dropdown = "Dropdown",
}

// todo: remove
const extractColumnTypes = (str: string) => {
    const header = str.split("\n")[0]
    return header
        .split(detectDelimiter(header))
        .slice(1)
        .map(
            (name) =>
                ControlType[name.split(" ").pop() as ControlType] || "Radio"
        )
}

// todo: remove
const removeColumnTypeInfo = (str: string) => {
    const lines = str.split("\n")
    const header = lines[0]
    const delimiter = detectDelimiter(header)
    const types = Object.values(ControlType).join("|")
    const reg = new RegExp("(" + types + ")$")
    lines[0] = header
        .split(delimiter)
        .map((cell) => cell.replace(reg, ""))
        .join(delimiter)
    return lines.join("\n")
}

// Takes the author's program and the user's current settings and returns an object for
// allow the user to navigate amongst charts.
export class SwitcherRuntime {
    private parsed: any[]
    @observable private _settings: any = {}
    constructor(delimited: string, queryString: string = "") {
        this.columnTypes = extractColumnTypes(delimited)
        delimited = removeColumnTypeInfo(delimited)
        this.parsed = parseDelimited(delimited)
        this.parsed.forEach((row) => {
            row.chartId = parseInt(row.chartId)
        })
        const queryParams = strToQueryParams(decodeURIComponent(queryString))
        this.columnNames.forEach((name) => {
            if (queryParams[name] === undefined)
                this.setValue(name, this.firstAvailableOptionForGroup(name))
            else this.setValue(name, queryParams[name])
        })
    }

    columnTypes: ControlType[]

    toObject() {
        return { ...this._settings }
    }

    @computed get toQueryParams(): QueryParams {
        return this.toObject()
    }

    static getRequiredChartIds(code: string) {
        return parseDelimited(code)
            .map((row) => parseInt(row.chartId!))
            .filter((id) => !isNaN(id))
    }

    toConstrainedOptions() {
        const settings = this.toObject()
        this.columnNames.forEach((group) => {
            if (!this.isOptionAvailable(group, settings[group]))
                settings[group] = this.firstAvailableOptionForGroup(group)
        })
        return settings
    }

    @action.bound setValue(group: string, value: any) {
        this._settings[group] = value
    }

    @computed get columnNames() {
        if (!this.parsed[0]) return []
        return Object.keys(this.parsed[0]).filter(
            (name) => name !== CHART_ID_SYMBOL
        )
    }

    @computed get groupOptions(): { [title: string]: string[] } {
        const optionMap: any = {}
        this.columnNames.forEach((title, index) => {
            optionMap[title] = uniq(
                this.parsed.map((row) => row[title])
            ).filter((cell) => !isCellEmpty(cell)) as string[]
        })
        return optionMap
    }

    firstAvailableOptionForGroup(group: string) {
        return this.groupOptions[group].find((option) =>
            this.isOptionAvailable(group, option)
        )
    }

    isOptionAvailable(groupName: string, optionName: string) {
        const query: any = {}
        const columnNames = this.columnNames
        columnNames.slice(0, columnNames.indexOf(groupName)).forEach((col) => {
            query[col] = this._settings[col]
        })
        query[groupName] = optionName
        return this.rowsWith(query, groupName).length > 0
    }

    rowIndexesWith(query: any, groupName?: string): number[] {
        return this.parsed
            .map((row, rowIndex) =>
                Object.keys(query)
                    .filter((key) => query[key] !== undefined)
                    .every(
                        (key) =>
                            row[key] === query[key] ||
                            (groupName && groupName !== key
                                ? isCellEmpty(row[key])
                                : false)
                    )
                    ? rowIndex
                    : null
            )
            .filter((index) => index !== null) as number[]
    }

    rowsWith(query: any, groupName?: string) {
        return this.rowIndexesWith(query, groupName).map(
            (index) => this.parsed[index]
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
        groupName: string,
        optionName: string,
        value: string
    ): ControlOption {
        return {
            label: optionName,
            checked: value === optionName,
            value: optionName,
            available: this.isOptionAvailable(groupName, optionName),
        }
    }

    @computed get groups(): Group[] {
        const constrainedOptions = this.toConstrainedOptions()
        return this.columnNames.map((title, index) => {
            const optionNames = this.groupOptions[title]
            let options = optionNames.map((optionName) =>
                this.toControlOption(
                    title,
                    optionName,
                    constrainedOptions[title]
                )
            )
            let dropdownOptions = undefined
            const type = this.columnTypes[index]

            const isCheckbox = type === ControlType.Checkbox
            if (isCheckbox)
                options = options.filter((opt) => opt.label !== FALSE_SYMBOL)

            if (type === "Dropdown") {
                dropdownOptions = options
            }

            return {
                title,
                value: constrainedOptions[title],
                options,
                dropdownOptions,
                isCheckbox,
            }
        })
    }

    toString() {
        return queryParamsToStr(this._settings)
    }
}

export class ExplorerQueryParams {
    @observable hideControls: boolean = false
    @observable selectedEntityNames: Set<string> = new Set<string>()

    constructor(queryString: string) {
        const obj = strToQueryParams(queryString)
        this.hideControls = obj.hideControls === "true"

        if (obj.country) {
            EntityUrlBuilder.queryParamToEntities(obj.country).forEach((code) =>
                this.selectedEntityNames.add(code)
            )
        }
    }

    @computed get toQueryParams(): QueryParams {
        const params: any = {}
        params.hideControls = this.hideControls ? true : undefined
        this.selectedEntityNames.size // Need to do a "dot" operation to get MobX to detect the read
        params.country = EntityUrlBuilder.entitiesToQueryParam(
            Array.from(this.selectedEntityNames)
        )
        return params as QueryParams
    }
}
