import { trimObject } from "clientUtils/Util"
import { queryParamsToStr } from "clientUtils/url"
import { action, observable, computed } from "mobx"
import { GitCommit, SubNavId } from "clientUtils/owidTypes"
import {
    ExplorerControlType,
    ExplorerChoiceOption,
    ExplorerControlTypeRegex,
    DefaultNewExplorerSlug,
    EXPLORERS_ROUTE_FOLDER,
    ExplorerChoice,
} from "explorer/ExplorerConstants"
import { CoreTable } from "coreTable/CoreTable"
import { CoreMatrix, TableSlug } from "coreTable/CoreTableConstants"
import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import {
    detectDelimiter,
    parseDelimited,
    isCellEmpty,
} from "coreTable/CoreTableUtils"
import { ExplorerGrammar } from "explorer/grammars/ExplorerGrammar"
import {
    CellDef,
    GridBoolean,
    GRID_CELL_DELIMITER,
    GRID_NODE_DELIMITER,
    Grammar,
    RootKeywordCellDef,
} from "gridLang/GridLangConstants"
import { OwidTable } from "coreTable/OwidTable"
import { GridProgram } from "gridLang/GridProgram"
import { SerializedGridProgram } from "gridLang/SerializedGridProgram"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { GrapherGrammar } from "explorer/grammars/GrapherGrammar"
import { ColumnGrammar } from "./ColumnGrammar"
import { objectToPatch, objectFromPatch } from "./Patch"

export const EXPLORER_FILE_SUFFIX = ".explorer.tsv"

export interface TableDef {
    url?: string
    columnDefinitions?: string
    inlineData?: string
}

interface ExplorerGrapherInterface extends GrapherInterface {
    grapherId?: number
    tableSlug?: string
    yScaleToggle?: boolean
    yAxisMin?: number
}

const ExplorerRootDef: CellDef = {
    ...RootKeywordCellDef,
    grammar: ExplorerGrammar,
}

export class ExplorerProgram extends GridProgram {
    constructor(slug: string, tsv: string, lastCommit?: GitCommit) {
        super(slug, tsv, lastCommit, ExplorerRootDef)
        this.decisionMatrix = new DecisionMatrix(
            this.decisionMatrixCode ?? "",
            lastCommit?.hash
        )
    }

    decisionMatrix: DecisionMatrix

    static fromJson(json: SerializedGridProgram) {
        return new ExplorerProgram(json.slug, json.program, json.lastCommit)
    }

    get clone() {
        return ExplorerProgram.fromJson(this.toJson())
    }

    get isNewFile() {
        return this.slug === DefaultNewExplorerSlug
    }

    get filename() {
        return this.slug + EXPLORER_FILE_SUFFIX
    }

    initDecisionMatrix(patch = "") {
        this.decisionMatrix.setValuesFromPatch(patch)
        return this
    }

    get fullPath() {
        return makeFullPath(this.slug)
    }

    get currentlySelectedGrapherRow() {
        const row = this.getKeywordIndex(ExplorerGrammar.graphers.keyword)
        return row === -1
            ? undefined
            : row + this.decisionMatrix.selectedRowIndex + 2
    }

    static fromMatrix(slug: string, matrix: CoreMatrix) {
        const str = matrix
            .map((row) => row.join(GRID_CELL_DELIMITER))
            .join(GRID_NODE_DELIMITER)
        return new ExplorerProgram(slug, str)
    }

    get explorerTitle() {
        return this.getLineValue(ExplorerGrammar.explorerTitle.keyword)
    }

    get subNavId(): SubNavId | undefined {
        return this.getLineValue(ExplorerGrammar.subNavId.keyword) as SubNavId
    }

    get googleSheet() {
        return this.getLineValue(ExplorerGrammar.googleSheet.keyword)
    }

    get hideAlertBanner() {
        return (
            this.getLineValue(ExplorerGrammar.hideAlertBanner.keyword) ===
            GridBoolean.true
        )
    }

    get subNavCurrentId() {
        return this.getLineValue(ExplorerGrammar.subNavCurrentId.keyword)
    }

    get thumbnail() {
        return this.getLineValue(ExplorerGrammar.thumbnail.keyword)
    }

    get explorerSubtitle() {
        return this.getLineValue(ExplorerGrammar.explorerSubtitle.keyword)
    }

    get entityType() {
        return this.getLineValue(ExplorerGrammar.entityType.keyword)
    }

    get selection() {
        return this.getLineValue(ExplorerGrammar.selection.keyword)
    }

    get pickerColumnSlugs() {
        const slugs = this.getLineValue(
            ExplorerGrammar.pickerColumnSlugs.keyword
        )
        return slugs ? slugs.split(" ") : undefined
    }

    get hideControls() {
        return this.getLineValue(ExplorerGrammar.hideControls.keyword)
    }

    get isPublished() {
        return (
            this.getLineValue(ExplorerGrammar.isPublished.keyword) ===
            GridBoolean.true
        )
    }

    setPublished(value: boolean) {
        return this.clone.setLineValue(
            ExplorerGrammar.isPublished.keyword,
            value ? GridBoolean.true : GridBoolean.false
        )
    }

    get wpBlockId() {
        const blockIdString = this.getLineValue(
            ExplorerGrammar.wpBlockId.keyword
        )
        return blockIdString ? parseInt(blockIdString, 10) : undefined
    }

    get decisionMatrixCode() {
        const keywordIndex = this.getKeywordIndex(
            ExplorerGrammar.graphers.keyword
        )
        if (keywordIndex === -1) return undefined
        return this.getBlock(keywordIndex)
    }

    get grapherCount() {
        return this.decisionMatrix.numRows || 1
    }

    get tableCount() {
        return this.lines.filter((line) =>
            line.startsWith(ExplorerGrammar.table.keyword)
        ).length
    }

    get inlineTableCount() {
        return this.lines
            .filter((line) => line.startsWith(ExplorerGrammar.table.keyword))
            .filter((line) => {
                const data = this.getTableDef(line.split(this.cellDelimiter)[1])
                    ?.inlineData
                return data ? data.trim() : false
            }).length
    }

    async replaceTableWithInlineDataAndAutofilledColumnDefsCommand(
        tableSlug?: string
    ) {
        const clone = this.clone

        const colDefRow = clone.getRowMatchingWords(
            ExplorerGrammar.columns.keyword,
            tableSlug
        )
        if (colDefRow > -1) {
            clone.deleteBlock(colDefRow)
            clone.deleteLine(colDefRow)
        }

        const table = await clone.tryFetchTableForTableSlugIfItHasUrl(tableSlug)

        const tableDefRow = clone.getRowMatchingWords(
            ExplorerGrammar.table.keyword,
            undefined,
            tableSlug
        )
        if (tableDefRow > -1) {
            clone.deleteBlock(tableDefRow)
            clone.deleteLine(tableDefRow)
        }

        const newCols = table!.autodetectedColumnDefs
        const missing = newCols
            .appendColumns([
                {
                    slug: ColumnGrammar.notes.keyword,
                    values: newCols.indices.map(() => `Unreviewed`),
                },
            ])
            .select([
                ColumnGrammar.slug.keyword,
                ,
                ColumnGrammar.name.keyword,
                ,
                ColumnGrammar.type.keyword,
                ColumnGrammar.notes.keyword,
            ] as string[])

        clone.appendBlock(ExplorerGrammar.table.keyword, table!.toTsv())
        clone.appendBlock(ExplorerGrammar.columns.keyword, missing.toTsv())
        return clone
    }

    async autofillMissingColumnDefinitionsForTableCommand(tableSlug?: string) {
        const clone = this.clone
        const remoteTable = await clone.tryFetchTableForTableSlugIfItHasUrl(
            tableSlug
        )
        const existingTableDef = this.getTableDef(tableSlug)
        const table =
            remoteTable ||
            (existingTableDef
                ? new CoreTable(
                      existingTableDef.inlineData,
                      existingTableDef.columnDefinitions
                  )
                : undefined)
        const newCols = table!.autodetectedColumnDefs
        const missing = newCols
            .appendColumns([
                {
                    slug: ColumnGrammar.notes.keyword,
                    values: newCols.indices.map(() => `Unreviewed`),
                },
            ])
            .select([
                ColumnGrammar.slug.keyword,
                ,
                ColumnGrammar.name.keyword,
                ,
                ColumnGrammar.type.keyword,
                ColumnGrammar.notes.keyword,
            ] as string[])

        const colDefsRow = this.getRowMatchingWords(
            ExplorerGrammar.columns.keyword,
            tableSlug
        )

        if (colDefsRow !== -1)
            clone.updateBlock(
                colDefsRow,
                new CoreTable(clone.getBlock(colDefsRow))
                    .concat([missing])
                    .toTsv()
            )
        else
            clone.appendBlock(
                `${ExplorerGrammar.columns.keyword}${
                    tableSlug ? this.cellDelimiter + tableSlug : ""
                }`,
                missing.toTsv()
            )
        return clone
    }

    getUrlForTableSlug(tableSlug?: TableSlug) {
        return this.getTableDef(tableSlug)?.url
    }

    get grapherConfig(): ExplorerGrapherInterface {
        const rootObject = trimAndParseObject(this.tuplesObject, GrapherGrammar)

        Object.keys(rootObject).forEach((key) => {
            if (!GrapherGrammar[key]) delete rootObject[key]
        })

        const selectedGrapherRow = this.decisionMatrix.selectedRow
        return selectedGrapherRow && Object.keys(selectedGrapherRow).length
            ? { ...rootObject, ...selectedGrapherRow }
            : rootObject
    }

    async tryFetchTableForTableSlugIfItHasUrl(tableSlug?: TableSlug) {
        const url = this.getUrlForTableSlug(tableSlug)
        if (!url) return undefined
        const tableDef = this.getTableDef(tableSlug)!
        const response = await fetch(url)
        if (!response.ok) throw new Error(response.statusText)
        const text = await response.text()
        const table = new OwidTable(text, tableDef.columnDefinitions, {
            tableDescription: `Loaded from ${url}`,
        })
        return table
    }

    getTableDef(tableSlug?: TableSlug): TableDef | undefined {
        const tableDefRow = this.getRowMatchingWords(
            ExplorerGrammar.table.keyword,
            undefined,
            tableSlug
        )
        if (tableDefRow === -1) return undefined

        const inlineData = this.getBlock(tableDefRow)
        let url = inlineData
            ? undefined
            : this.lines[tableDefRow].split(this.cellDelimiter)[1]

        if (url && !url.startsWith("http")) {
            const owidDatasetSlug = encodeURIComponent(url)
            url = `https://raw.githubusercontent.com/owid/owid-datasets/master/datasets/${owidDatasetSlug}/${owidDatasetSlug}.csv`
        }

        const colDefsRow = this.getRowMatchingWords(
            ExplorerGrammar.columns.keyword,
            tableSlug
        )

        return {
            url,
            columnDefinitions:
                colDefsRow !== -1 ? this.getBlock(colDefsRow) : undefined,
            inlineData,
        }
    }
}

// todo: cleanup
const makeChoicesMap = (delimited: string) => {
    const headerLine = delimited.split("\n")[0]
    const map = new Map<ChoiceName, ExplorerControlType>()
    headerLine
        .split(detectDelimiter(headerLine))
        .filter((name) => ExplorerControlTypeRegex.test(name))
        .forEach((choiceName) => {
            const words = choiceName.split(" ")
            const type = words[words.length - 1] as ExplorerControlType
            map.set(words.join(" "), type)
        })
    return map
}

type ChoiceName = string
type ChoiceValue = string

interface DecisionsPatchObject {
    [choiceName: string]: ChoiceValue
}

interface ChoiceMap {
    [choiceName: string]: ChoiceValue[]
}

// Takes the author's program and the user's current settings and returns an object for
// allow the user to navigate amongst charts.
export class DecisionMatrix {
    private table: CoreTable
    @observable currentPatch: DecisionsPatchObject = {}
    constructor(delimited: string, hash = "") {
        this.choices = makeChoicesMap(delimited)
        this.table = new CoreTable(parseDelimited(delimited), [
            // todo: remove col def?
            {
                slug: GrapherGrammar.grapherId.keyword,
                type: ColumnTypeNames.Integer,
            },
        ])
        this.hash = hash
        this.setValuesFromPatch() // Initialize options
    }

    allDecisionsAsPatches() {
        return this.table.rows.map((row) => {
            const patchObject: DecisionsPatchObject = {}
            this.choiceNames.forEach((name) => {
                patchObject[name] = row[name]
            })
            return objectToPatch(patchObject)
        })
    }

    get numRows() {
        return this.table.numRows
    }

    get requiredGrapherIds() {
        return this.table.get(GrapherGrammar.grapherId.keyword).uniqValues
    }

    private choices: Map<ChoiceName, ExplorerControlType>
    hash: string

    toConstrainedOptions() {
        const settings = { ...this.currentPatch }
        this.choiceNames.forEach((choiceName) => {
            if (!this.isOptionAvailable(choiceName, settings[choiceName]))
                settings[choiceName] = this.firstAvailableOptionForChoice(
                    choiceName
                )!
        })
        return settings
    }

    @computed private get diffBetweenUserSettingsAndConstrained() {
        const obj = this.toConstrainedOptions()
        Object.keys(obj).forEach((key) => {
            if (this.currentPatch[key] === obj[key]) delete obj[key]
        })
        return obj
    }

    @action.bound setValueCommand(choiceName: ChoiceName, value: ChoiceValue) {
        const currentInvalidState = this.diffBetweenUserSettingsAndConstrained
        this._setValue(choiceName, value)
        const newInvalidState = this.diffBetweenUserSettingsAndConstrained
        if (Object.keys(newInvalidState).length) {
            Object.keys(currentInvalidState).forEach((key) => {
                /**
                 * The user navigated to an invalid state. Then they made a change in the new state, but the old invalid props were still set. At this
                 * point, we should delete the old invalid props. We only want to allow the user to go back 1, not a full undo/redo history.
                 */
                if (currentInvalidState[key] === newInvalidState[key])
                    this._setValue(key, currentInvalidState[key])
            })
        }
    }

    @action.bound private _setValue(
        choiceName: ChoiceName,
        value: ChoiceValue
    ) {
        if (value === "") delete this.currentPatch[choiceName]
        else this.currentPatch[choiceName] = value
    }

    @action.bound private setValuesFromPatchObject(
        patchObject: DecisionsPatchObject
    ) {
        this.choiceNames.forEach((choiceName) => {
            if (patchObject[choiceName] === undefined)
                this._setValue(
                    choiceName,
                    this.firstAvailableOptionForChoice(choiceName)!
                )
            else this._setValue(choiceName, patchObject[choiceName]!)
        })
        return this
    }

    @action.bound setValuesFromPatch(patch = "") {
        return this.setValuesFromPatchObject(
            objectFromPatch(decodeURIComponent(patch)) as DecisionsPatchObject
        )
    }

    @computed private get choiceNames(): ChoiceName[] {
        return Array.from(this.choices.keys())
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

    /**
     * Note: there is a rare bug in here + rowsWith when an author has a complex decision matrix. If the user vists a url
     * with invalid options like Metric="Tests", Interval="Weekly", Aligned="false"
     * we will return first match, which is B1, even though B2 is a better match.
     *
     * graphers
     * title	Metric Radio	Interval Radio	Aligned Checkbox
     * A1	Cases	Cumulative	true
     * A2	Cases	Cumulative	false
     * A3	Cases	Weekly	false
     *
     * B1	Tests	Cumulative	true
     * B2	Tests	Cumulative	false
     */
    isOptionAvailable(
        choiceName: ChoiceName,
        option: ChoiceValue,
        currentState = this.currentPatch
    ) {
        const query: DecisionsPatchObject = {}
        this.choiceNames
            .slice(0, this.choiceNames.indexOf(choiceName))
            .forEach((name) => {
                query[name] = currentState[name]
            })
        query[choiceName] = option
        return this.rowsWith(query, choiceName).length > 0
    }

    private rowsWith(query: DecisionsPatchObject, choiceName?: ChoiceName) {
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
        const query = this.toConstrainedOptions()
        const hits = this.rowsWith(query)
        return hits[0]
    }

    @computed get selectedRowIndex() {
        return this.firstMatch === undefined
            ? 0
            : this.table.indexOf(this.firstMatch)
    }

    @computed get selectedRow() {
        return trimAndParseObject(
            this.table.rowsAt([this.selectedRowIndex])[0],
            GrapherGrammar
        )
    }

    private toControlOption(
        choiceName: ChoiceName,
        optionName: string,
        currentValue: ChoiceValue,
        constrainedOptions: DecisionsPatchObject
    ): ExplorerChoiceOption {
        const available = this.isOptionAvailable(
            choiceName,
            optionName,
            constrainedOptions
        )
        return {
            label: optionName,
            value: optionName,
            available,
            checked: currentValue === optionName,
        }
    }

    @computed get choicesWithAvailability(): ExplorerChoice[] {
        const selectedRow = this.selectedRow
        const constrainedOptions = this.toConstrainedOptions()
        return this.choiceNames.map((title) => {
            const value =
                selectedRow[title] !== undefined
                    ? selectedRow[title].toString()
                    : selectedRow[title]
            const options = this.allChoiceOptions[title].map((optionName) =>
                this.toControlOption(
                    title,
                    optionName,
                    value,
                    constrainedOptions
                )
            )
            const type = this.choices.get(title)!
            const displayTitle = removeChoiceControlTypeInfo(title)

            return {
                title,
                displayTitle,
                type,
                value,
                options:
                    type === ExplorerControlType.Checkbox
                        ? makeCheckBoxOption(options, displayTitle)
                        : options,
            }
        })
    }

    toString() {
        return queryParamsToStr(this.currentPatch)
    }
}

// This strips the "Dropdown" or "Checkbox" from "SomeChoice Dropdown" or "SomeChoice Checkbox"
const removeChoiceControlTypeInfo = (label: string) =>
    label.replace(ExplorerControlTypeRegex, "")

const makeCheckBoxOption = (
    options: ExplorerChoiceOption[],
    choiceName: string
) => {
    const checked = options.some(
        (option) => option.checked === true && option.value === GridBoolean.true
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
        } as ExplorerChoiceOption,
    ]
}

export const makeFullPath = (slug: string) =>
    `${EXPLORERS_ROUTE_FOLDER}/${slug}${EXPLORER_FILE_SUFFIX}`

const trimAndParseObject = (config: any, grammar: Grammar) => {
    // Trim empty properties. Prevents things like clearing "type" which crashes Grapher. The call to grapher.reset will automatically clear things like title, subtitle, if not set.
    const trimmedRow = trimObject(config, true)

    // parse types
    Object.keys(trimmedRow).forEach((key) => {
        const def = grammar[key]
        if (def && def.parse) trimmedRow[key] = def.parse(trimmedRow[key])
        // If there no definition but it is a boolean, parse it (todo: always have a def)
        else if (!def) {
            const value = trimmedRow[key]
            if (value === GridBoolean.true) trimmedRow[key] = true
            else if (value === GridBoolean.false) trimmedRow[key] = false
        }
    })
    return trimmedRow
}
