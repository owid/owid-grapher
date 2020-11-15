import { fetchText, trimObject } from "grapher/utils/Util"
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
import { CoreMatrix, TableSlug } from "coreTable/CoreTableConstants"
import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import {
    detectDelimiter,
    parseDelimited,
    isCellEmpty,
} from "coreTable/CoreTableUtils"
import { getRequiredGrapherIds } from "./ExplorerUtils"
import {
    ColumnsSubTableHeaderKeywordMap,
    ExplorerGrammar,
    ExplorerRootKeywordMap,
} from "./ExplorerGrammar"
import {
    GridBoolean,
    GRID_CELL_DELIMITER,
    GRID_NODE_DELIMITER,
} from "explorer/gridLang/GridLangConstants"
import { GitCommit } from "gitCms/GitTypes"
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"
import { GridProgram } from "explorer/gridLang/GridProgram"
import { SerializedGridProgram } from "explorer/gridLang/SerializedGridProgram"

const CHART_ID_SYMBOL = "chartId"

interface Choice {
    title: string
    options: ExplorerControlOption[]
    value: string
    type: ExplorerControlType
}

export const EXPLORER_FILE_SUFFIX = ".explorer.tsv"

export interface TableDef {
    url?: string
    columnDefinitions?: string
    inlineData?: string
}

export class ExplorerProgram extends GridProgram {
    constructor(slug: string, tsv: string, lastCommit?: GitCommit) {
        super(slug, tsv, lastCommit, ExplorerGrammar)
        this.decisionMatrix = new DecisionMatrix(
            this.decisionMatrixCode ?? "",
            lastCommit?.hash
        )
    }

    decisionMatrix: DecisionMatrix

    static fromJson(json: SerializedGridProgram) {
        return new ExplorerProgram(json.slug, json.program, json.lastCommit)
    }

    private get clone() {
        return ExplorerProgram.fromJson(this.toJson())
    }

    get isNewFile() {
        return this.slug === DefaultNewExplorerSlug
    }

    get filename() {
        return this.slug + EXPLORER_FILE_SUFFIX
    }

    initDecisionMatrix(queryStr = "") {
        this.decisionMatrix.setValuesFromQueryString(
            queryStr || this.defaultView
        )
        return this
    }

    get fullPath() {
        return makeFullPath(this.slug)
    }

    get requiredGrapherIds() {
        return getRequiredGrapherIds(this.decisionMatrixCode ?? "")
    }

    static fromMatrix(slug: string, matrix: CoreMatrix) {
        const str = matrix
            .map((row) => row.join(GRID_CELL_DELIMITER))
            .join(GRID_NODE_DELIMITER)
        return new ExplorerProgram(slug, str)
    }

    get explorerTitle() {
        return this.getLineValue(ExplorerRootKeywordMap.explorerTitle.keyword)
    }

    get subNavId(): SubNavId | undefined {
        return this.getLineValue(
            ExplorerRootKeywordMap.subNavId.keyword
        ) as SubNavId
    }

    get googleSheet() {
        return this.getLineValue(ExplorerRootKeywordMap.googleSheet.keyword)
    }

    get hideAlertBanner() {
        return (
            this.getLineValue(
                ExplorerRootKeywordMap.hideAlertBanner.keyword
            ) === GridBoolean.true
        )
    }

    get subNavCurrentId() {
        return this.getLineValue(ExplorerRootKeywordMap.subNavCurrentId.keyword)
    }

    get thumbnail() {
        return this.getLineValue(ExplorerRootKeywordMap.thumbnail.keyword)
    }

    get explorerSubtitle() {
        return this.getLineValue(
            ExplorerRootKeywordMap.explorerSubtitle.keyword
        )
    }

    get entityType() {
        return this.getLineValue(ExplorerRootKeywordMap.entityType.keyword)
    }

    get pickerColumnSlugs() {
        const slugs = this.getLineValue(
            ExplorerRootKeywordMap.pickerColumnSlugs.keyword
        )
        return slugs ? slugs.split(" ") : undefined
    }

    get defaultView() {
        return this.getLineValue(ExplorerRootKeywordMap.defaultView.keyword)
    }

    get hideControls() {
        return this.getLineValue(ExplorerRootKeywordMap.hideControls.keyword)
    }

    get isPublished() {
        return (
            this.getLineValue(ExplorerRootKeywordMap.isPublished.keyword) ===
            GridBoolean.true
        )
    }

    setPublished(value: boolean) {
        return this.clone.setLineValue(
            ExplorerRootKeywordMap.isPublished.keyword,
            value ? GridBoolean.true : GridBoolean.false
        )
    }

    get wpBlockId() {
        const blockIdString = this.getLineValue(
            ExplorerRootKeywordMap.wpBlockId.keyword
        )
        return blockIdString ? parseInt(blockIdString, 10) : undefined
    }

    get decisionMatrixCode() {
        const keywordIndex = this.getKeywordIndex(
            ExplorerRootKeywordMap.switcher.keyword
        )
        if (keywordIndex === -1) return undefined
        return this.getBlock(keywordIndex)
    }

    async autofillMissingColumnDefinitionsForTable(tableSlug?: string) {
        const clone = this.clone
        await clone.fetchTableAndStoreInCache(tableSlug)
        const table = clone.getTableForSlug(tableSlug)
        const newCols = table.autodetectedColumnDefs
        const missing = newCols
            .appendColumns([
                {
                    slug: ColumnsSubTableHeaderKeywordMap.notes.keyword,
                    values: newCols.indices.map(() => `Unreviewed`),
                },
            ])
            .select([
                ColumnsSubTableHeaderKeywordMap.slug.keyword,
                ,
                ColumnsSubTableHeaderKeywordMap.name.keyword,
                ,
                ColumnsSubTableHeaderKeywordMap.type.keyword,
                ColumnsSubTableHeaderKeywordMap.notes.keyword,
            ] as string[])

        const cdRow = this.getColumnDefinitionsRowForTableSlug(tableSlug)

        if (cdRow !== undefined)
            clone.updateBlock(
                cdRow,
                new CoreTable(clone.getBlock(cdRow)).concat([missing]).toTsv()
            )
        else
            clone.appendBlock(
                `${ExplorerRootKeywordMap.columns.keyword}${
                    tableSlug ? this.cellDelimiter + tableSlug : ""
                }`,
                missing.toTsv()
            )
        return clone
    }

    getTableForSlug(tableSlug?: TableSlug) {
        const tableDef = this.getTableDef(tableSlug)
        if (!tableDef) return BlankOwidTable()
        if (tableDef.url) {
            const cached = ExplorerProgram.fetchedTableCache.get(tableDef.url)
            if (cached) return cached
            return BlankOwidTable()
        }
        return new OwidTable(tableDef.inlineData, tableDef.columnDefinitions, {
            tableDescription: `Loaded from inline data`,
        }).dropEmptyRows()
    }

    private static fetchedTableCache = new Map<string, OwidTable>()
    async fetchTableAndStoreInCache(tableSlug?: TableSlug) {
        const tableDef = this.getTableDef(tableSlug)
        if (!tableDef || !tableDef.url) return false
        const path = tableDef.url
        const csv = await fetchText(path)
        const table = new OwidTable(csv, tableDef.columnDefinitions, {
            tableDescription: `Loaded from ${path}`,
        })
        ExplorerProgram.fetchedTableCache.set(path, table)
        return true
    }

    private getColumnDefinitionsRowForTableSlug(tableSlug?: TableSlug) {
        return this.getRowNumbersStartingWith(
            `${ExplorerRootKeywordMap.columns.keyword}${
                tableSlug ? this.cellDelimiter + tableSlug : ""
            }`
        )[0]
    }

    getTableDef(tableSlug?: TableSlug): TableDef | undefined {
        const matchingTableIndex = this.getRowNumbersStartingWith(
            `${ExplorerRootKeywordMap.table.keyword}${
                tableSlug ? this.cellDelimiter + tableSlug : ""
            }`
        )[0]
        if (matchingTableIndex === undefined) return undefined

        let url = this.lines[matchingTableIndex].split(this.cellDelimiter)[1]

        if (url && !url.startsWith("http")) {
            const owidDatasetSlug = encodeURIComponent(url)
            url = `https://raw.githubusercontent.com/owid/owid-datasets/master/datasets/${owidDatasetSlug}/${owidDatasetSlug}.csv`
        }

        const colRow = this.getColumnDefinitionsRowForTableSlug(tableSlug)

        return {
            url,
            columnDefinitions:
                colRow !== undefined ? this.getBlock(colRow) : undefined,
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
    constructor(delimited: string, hash = "") {
        this.choiceControlTypes = makeControlTypesMap(delimited)
        delimited = removeChoiceControlTypeInfo(delimited)
        this.table = new CoreTable(parseDelimited(delimited), [
            { slug: CHART_ID_SYMBOL, type: ColumnTypeNames.Integer },
        ])
        this.hash = hash
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
    private hash: string

    toObject(): DecisionMatrixQueryParams {
        return { ...this._settings }
    }

    @computed get params(): DecisionMatrixQueryParams {
        return { ...this.toObject(), hash: this.hash.substring(0, 8) }
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

    @computed private get selectedRowIndex() {
        return this.firstMatch === undefined
            ? 0
            : this.table.indexOf(this.firstMatch)
    }

    @computed get selectedRow() {
        const selectedRow = this.table.rowsAt([this.selectedRowIndex])[0]

        // Trim empty properties. Prevents things like clearing "type" which crashes Grapher. The call to grapher.reset will automatically clear things like title, subtitle, if not set.
        const trimmedRow = trimObject(selectedRow, true)

        // parse boolean
        Object.keys(trimmedRow).forEach((key) => {
            const value = trimmedRow[key]
            if (value === GridBoolean.true) trimmedRow[key] = true
            else if (value === GridBoolean.false) trimmedRow[key] = false
        })

        return trimmedRow
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
                        ? makeCheckBoxOption(options, title)
                        : options,
            }
        })
    }

    toString() {
        return queryParamsToStr(this._settings)
    }
}

const makeCheckBoxOption = (
    options: ExplorerControlOption[],
    choiceName: string
) => {
    const checked = options.some(
        (option) => option.checked === true && option.label === GridBoolean.true
    )
    const available =
        new Set(options.filter((opt) => opt.available).map((opt) => opt.label))
            .size === 2
    return [
        {
            label: choiceName,
            checked,
            value: GridBoolean.true,
            available,
        } as ExplorerControlOption,
    ]
}

export const makeFullPath = (slug: string) =>
    `explorers/${slug}${EXPLORER_FILE_SUFFIX}`
