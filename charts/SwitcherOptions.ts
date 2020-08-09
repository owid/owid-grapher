import { queryParamsToStr, strToQueryParams } from "utils/client/url"
import { uniq, parseDelimited, isCellEmpty } from "./Util"
import { ControlOption } from "./ExplorerControls"
import { action, observable, computed } from "mobx"

const CHART_ID_SYMBOL = "chartId"
const FALSE_SYMBOL = "FALSE"

interface Group {
    title: string
    options: ControlOption[]
    value: string
    isCheckbox: boolean
}

export class SwitcherOptions {
    private parsed: any[]
    @observable private _settings: any
    constructor(delimited: string, queryString: string = "") {
        this.parsed = parseDelimited(delimited)
        this.parsed.forEach(row => {
            row.chartId = parseInt(row.chartId)
        })
        this._settings = strToQueryParams(queryString)
        this.columnNames.forEach(name => {
            if (this._settings[name] === undefined)
                this.setValue(name, this.firstAvailableOptionForGroup(name))
        })
    }

    toObject() {
        return { ...this._settings }
    }

    static getRequiredChartIds(code: string) {
        return parseDelimited(code)
            .map(row => parseInt(row.chartId!))
            .filter(id => !isNaN(id))
    }

    toConstrainedOptions() {
        const settings = this.toObject()
        this.columnNames.forEach(group => {
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
            name => name !== CHART_ID_SYMBOL
        )
    }

    @computed get groupOptions(): { [title: string]: string[] } {
        const optionMap: any = {}
        this.columnNames.forEach((title, index) => {
            optionMap[title] = uniq(this.parsed.map(row => row[title])).filter(
                cell => !isCellEmpty(cell)
            ) as string[]
        })
        return optionMap
    }

    firstAvailableOptionForGroup(group: string) {
        return this.groupOptions[group].find(option =>
            this.isOptionAvailable(group, option)
        )
    }

    isOptionAvailable(groupName: string, optionName: string) {
        const query: any = {}
        const columnNames = this.columnNames
        columnNames.slice(0, columnNames.indexOf(groupName)).forEach(col => {
            query[col] = this._settings[col]
        })
        query[groupName] = optionName
        return this.rowsWith(query, groupName).length > 0
    }

    rowsWith(query: any, groupName?: string) {
        return this.parsed.filter(row =>
            Object.keys(query)
                .filter(key => query[key] !== undefined)
                .every(
                    key =>
                        row[key] === query[key] ||
                        (groupName && groupName !== key
                            ? isCellEmpty(row[key])
                            : false)
                )
        )
    }

    @computed get chartId(): number {
        const row = this.rowsWith(this.toConstrainedOptions())[0]
        return row?.chartId
    }

    toControlOption(groupName: string, optionName: string): ControlOption {
        return {
            label: optionName,
            checked: this._settings[groupName] === optionName,
            value: optionName,
            available: this.isOptionAvailable(groupName, optionName)
        }
    }

    isBooleanGroup(groupOptions: ControlOption[]) {
        return (
            groupOptions.length === 2 &&
            groupOptions.some(opt => opt.label === FALSE_SYMBOL)
        )
    }

    @computed get groups(): Group[] {
        return this.columnNames.map(title => {
            const optionNames = this.groupOptions[title]
            let options = optionNames.map(optionName =>
                this.toControlOption(title, optionName)
            )

            const isCheckbox = this.isBooleanGroup(options)
            if (isCheckbox)
                options = options.filter(opt => opt.label !== FALSE_SYMBOL)

            return {
                title,
                value: this._settings[title] || options[0]?.value,
                options,
                isCheckbox
            }
        })
    }

    toString() {
        return queryParamsToStr(this._settings)
    }
}
