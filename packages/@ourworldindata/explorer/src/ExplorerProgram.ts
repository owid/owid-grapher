import * as _ from "lodash-es"
/* eslint-disable no-sparse-arrays */
import {
    CoreMatrix,
    ColumnTypeNames,
    CoreTableInputOption,
    OwidColumnDef,
    TableSlug,
    SubNavId,
    FacetAxisDomain,
    GrapherInterface,
    AxisMinMaxValueStr,
    GrapherChartType,
} from "@ourworldindata/types"
import {
    CoreTable,
    OwidTable,
    isNotErrorValue,
} from "@ourworldindata/core-table"
import {
    GitCommit,
    PromiseCache,
    SerializedGridProgram,
    trimObject,
    fetchWithRetry,
} from "@ourworldindata/utils"
import {
    CellDef,
    Grammar,
    GridBoolean,
    GRID_CELL_DELIMITER,
    GRID_NODE_DELIMITER,
    RootKeywordCellDef,
} from "./gridLang/GridLangConstants.js"
import { GridProgram } from "./gridLang/GridProgram.js"
import { ColumnGrammar } from "./ColumnGrammar.js"
import {
    DefaultNewExplorerSlug,
    ExplorerChartCreationMode,
    ExplorerChoiceParams,
    EXPLORERS_ROUTE_FOLDER,
} from "./ExplorerConstants.js"
import { DecisionMatrix } from "./ExplorerDecisionMatrix.js"
import { ExplorerGrammar } from "./ExplorerGrammar.js"
import { GrapherGrammar } from "./GrapherGrammar.js"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"

export const EXPLORER_FILE_SUFFIX = ".explorer.tsv"

export interface TableDef {
    url?: string
    columnDefinitions?: OwidColumnDef[]
    inlineData?: string[][]
    slug?: TableSlug
}

interface ExplorerGrapherInterface extends GrapherInterface {
    grapherId?: number
    tableSlug?: string
    yVariableIds?: string
    xVariableId?: string
    colorVariableId?: string
    sizeVariableId?: string
    yScaleToggle?: boolean
    yAxisMin?: number | AxisMinMaxValueStr.auto
    facetYDomain?: FacetAxisDomain
    relatedQuestionText?: string
    relatedQuestionUrl?: string
    mapTargetTime?: number
    type?: GrapherChartType | "LineChart SlopeChart" | "None"
}

const ExplorerRootDef: CellDef = {
    ...RootKeywordCellDef,
    grammar: ExplorerGrammar,
}

export class ExplorerProgram extends GridProgram {
    constructor(slug: string, tsv: string, lastCommit?: GitCommit) {
        super(slug, tsv, lastCommit, ExplorerRootDef)
    }

    private _decisionMatrix?: DecisionMatrix
    get decisionMatrix() {
        if (!this._decisionMatrix) {
            this._decisionMatrix = new DecisionMatrix(
                this.decisionMatrixCode ?? "",
                this.lastCommit?.hash
            )
        }
        return this._decisionMatrix
    }

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

    initDecisionMatrix(choiceParams: ExplorerChoiceParams) {
        this.decisionMatrix.setValuesFromChoiceParams(choiceParams)
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
            .map((row) =>
                row.map((cell) => cell && `${cell}`.replace(/\n/g, "\\n"))
            )
            .map((row) => row.join(GRID_CELL_DELIMITER))
            .join(GRID_NODE_DELIMITER)
        return new ExplorerProgram(slug, str)
    }

    get explorerTitle() {
        return this.getLineValue(ExplorerGrammar.explorerTitle.keyword)
    }

    get title() {
        return this.getLineValue(ExplorerGrammar.title.keyword)
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
        return this.getLine(ExplorerGrammar.selection.keyword)?.slice(1)
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

    get downloadDataLink() {
        return this.getLineValue(ExplorerGrammar.downloadDataLink.keyword)
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
            ?.map((row) => row.join(this.cellDelimiter))
            .join("\n")
    }

    get grapherCount() {
        return this.decisionMatrix.numRows || 1
    }

    get tableCount() {
        return this.getRowNumbersStartingWith(ExplorerGrammar.table.keyword)
            .length
    }

    get tableSlugs(): (TableSlug | undefined)[] {
        return this.lines
            .filter((line) => line[0] === ExplorerGrammar.table.keyword)
            .map((line) => line[2])
    }

    // for backward compatibility, we currently support explorers
    // that use Grapher IDs as well as CSV data files to create charts,
    // but we plan to drop support for mixed-content explorers in the future
    get chartCreationMode(): ExplorerChartCreationMode {
        const { decisionMatrix, explorerGrapherConfig } = this
        const { grapherId } = explorerGrapherConfig
        const yVariableIdsColumn = decisionMatrix.table.get(
            GrapherGrammar.yVariableIds.keyword
        )
        // referring to a variable in a single row triggers
        // ExplorerChartCreationMode.FromVariableIds for all rows
        if (yVariableIdsColumn.numValues)
            return ExplorerChartCreationMode.FromVariableIds
        if (grapherId && isNotErrorValue(grapherId))
            return ExplorerChartCreationMode.FromGrapherId
        return ExplorerChartCreationMode.FromExplorerTableColumnSlugs
    }

    get whyIsExplorerProgramInvalid(): string {
        const {
            chartCreationMode,
            decisionMatrix: { table },
        } = this
        const { FromVariableIds, FromGrapherId, FromExplorerTableColumnSlugs } =
            ExplorerChartCreationMode

        const grapherIdColumn = table.get(GrapherGrammar.grapherId.keyword)
        const tableSlugColumn = table.get(GrapherGrammar.tableSlug.keyword)
        const hasGrapherId = grapherIdColumn.numValues > 0
        const hasCsvData = tableSlugColumn.numValues > 0 || this.tableCount > 0

        if (chartCreationMode === FromVariableIds && hasGrapherId)
            return "Using variables IDs and Grapher IDs to create charts is not supported."

        if (chartCreationMode === FromVariableIds && hasCsvData)
            return "Using variable IDs and CSV data files to create charts is not supported."

        if (
            (chartCreationMode === FromGrapherId && hasCsvData) ||
            (chartCreationMode === FromExplorerTableColumnSlugs && hasGrapherId)
        )
            return "Using Grapher IDs and CSV data files to create charts is deprecated."

        return ""
    }

    get columnDefsByTableSlug(): Map<TableSlug | undefined, OwidColumnDef[]> {
        const columnDefs = new Map<TableSlug | undefined, OwidColumnDef[]>()
        const colDefsRows = this.getAllRowsMatchingWords(
            ExplorerGrammar.columns.keyword
        )

        const matrix = this.lines
        for (const row of colDefsRows) {
            const tableSlugs = matrix[row].slice(1)
            const columnDefinitions = parseColumnDefs(this.getBlock(row) ?? [])
            if (tableSlugs.length === 0)
                columnDefs.set(undefined, columnDefinitions)
            else
                tableSlugs.forEach((tableSlug) => {
                    columnDefs.set(tableSlug, columnDefinitions)
                })
        }
        return columnDefs
    }

    get columnDefsWithoutTableSlug(): OwidColumnDef[] {
        return this.columnDefsByTableSlug.get(undefined) ?? []
    }

    async autofillMissingColumnDefinitionsForTableCommand(tableSlug?: string) {
        const clone = this.clone
        const remoteTable = await clone.constructTable(tableSlug)
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
                    .toMatrix()
            )
        else
            clone.appendBlock(
                `${ExplorerGrammar.columns.keyword}${
                    tableSlug ? this.cellDelimiter + tableSlug : ""
                }`,
                missing.toMatrix()
            )
        return clone
    }

    /**
     * Grapher config for the currently selected row including global settings.
     * Includes all columns that are part of the GrapherGrammar.
     */
    get explorerGrapherConfig(): ExplorerGrapherInterface {
        const rootObject = trimAndParseObject(this.tuplesObject, GrapherGrammar)
        let config = { ...rootObject }

        const selectedGrapherRow = this.decisionMatrix.selectedRow
        if (selectedGrapherRow && Object.keys(selectedGrapherRow).length) {
            config = { ...config, ...selectedGrapherRow }
        }

        // remove all keys that are not part of the GrapherGrammar
        Object.keys(config).forEach((key) => {
            if (!GrapherGrammar[key]) delete config[key]
        })

        return config
    }

    /**
     * Grapher config for the currently selected row, with explorer-specific
     * fields translated to valid GrapherInterface fields.
     *
     * For example, `yAxisMin` is translated to `{yAxis: {min: ... }}`
     */
    get grapherConfig(): GrapherInterface {
        const partialConfigs: GrapherInterface[] = []
        const fields = Object.entries(this.explorerGrapherConfig)
        for (const [field, value] of fields) {
            const cellDef = GrapherGrammar[field]
            partialConfigs.push(cellDef.toGrapherObject(value))
        }

        const mergedConfig = _.merge({}, ...partialConfigs)

        // assume config is valid against the latest schema
        mergedConfig.$schema = latestGrapherConfigSchema

        // TODO: can be removed once relatedQuestions is refactored
        const { relatedQuestionUrl, relatedQuestionText } =
            this.explorerGrapherConfig
        if (relatedQuestionUrl && relatedQuestionText) {
            mergedConfig.relatedQuestions = [
                { url: relatedQuestionUrl, text: relatedQuestionText },
            ]
        }

        return mergedConfig
    }

    /**
     * A static method so that all explorers on the page share requests,
     * and no duplicate requests are sent.
     */
    private static tableDataLoader = new PromiseCache(
        async (url: string): Promise<CoreTableInputOption> => {
            const response = await fetchWithRetry(url)
            if (!response.ok) throw new Error(response.statusText)
            const tableInput: CoreTableInputOption = url.endsWith(".json")
                ? await response.json()
                : await response.text()
            return tableInput
        }
    )

    async constructTable(tableSlug?: TableSlug): Promise<OwidTable> {
        const tableDef = this.getTableDef(tableSlug)
        if (!tableDef) {
            throw new Error(`Table definitions not found for '${tableSlug}'`)
        }

        if (tableDef.inlineData) {
            return new OwidTable(
                tableDef.inlineData,
                tableDef.columnDefinitions,
                {
                    tableDescription: `Loaded '${tableSlug}' from inline data`,
                    tableSlug: tableSlug,
                }
            ).dropEmptyRows()
        } else if (tableDef.url) {
            const input = await ExplorerProgram.tableDataLoader.get(
                tableDef.url
            )
            return new OwidTable(input, tableDef.columnDefinitions, {
                tableDescription: `Loaded from ${tableDef.url}`,
            })
        }

        throw new Error(`No data for table '${tableSlug}'`)
    }

    getTableDef(tableSlug?: TableSlug): TableDef | undefined {
        const tableDefRow = this.getRowMatchingWords(
            ExplorerGrammar.table.keyword,
            undefined,
            tableSlug
        )
        if (tableDefRow === -1) return undefined

        const inlineData = this.getBlock(tableDefRow)
        let url = inlineData ? undefined : this.lines[tableDefRow][1]

        if (url && !url.startsWith("http")) {
            const owidDatasetSlug = encodeURIComponent(url)
            url = `https://raw.githubusercontent.com/owid/owid-datasets/master/datasets/${owidDatasetSlug}/${owidDatasetSlug}.csv`
        }

        const columnDefinitions: OwidColumnDef[] | undefined =
            this.columnDefsByTableSlug.get(tableSlug)

        return {
            url,
            columnDefinitions,
            inlineData,
            slug: tableSlug,
        }
    }
}

export const makeFullPath = (slug: string) =>
    `${EXPLORERS_ROUTE_FOLDER}/${slug}${EXPLORER_FILE_SUFFIX}`

export const trimAndParseObject = (config: any, grammar: Grammar) => {
    // Trim empty properties. Prevents things like clearing "type" which crashes Grapher. The call to grapher.reset will automatically clear things like title, subtitle, if not set.
    const trimmedRow = trimObject(config, true) as any

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

const parseColumnDefs = (block: string[][]): OwidColumnDef[] => {
    /**
     * A column def line can have:
     * - a column named `variableId`, which contains a variable id
     * - a column named `slug`, which is the referenced column in its data file
     *
     * We want to filter out any rows that contain neither of those, and we also
     * want to rename `variableId` to `owidVariableId`.
     */
    const columnsTable = new CoreTable(block)
        .appendColumnsIfNew([
            { slug: "slug", type: ColumnTypeNames.String, name: "slug" },
            {
                slug: "variableId",
                type: ColumnTypeNames.Integer,
                name: "variableId",
            },
        ])
        .renameColumn("variableId", "owidVariableId")
        // Filter out rows that neither have a slug nor an owidVariableId
        .rowFilter(
            (row) => !!(row.slug || typeof row.owidVariableId === "number"),
            "Keep only column defs with a slug or variable id"
        )
    return columnsTable.rows.map((row) => {
        // ignore slug if a variable id is given
        const hasValidVariableId =
            row.owidVariableId && isNotErrorValue(row.owidVariableId)
        if (hasValidVariableId && row.slug) delete row.slug

        for (const field in row) {
            const cellDef = ColumnGrammar[field]
            if (cellDef?.display) {
                // move field into 'display' object
                row.display = row.display || {}
                row.display[field] = row[field]
                delete row[field]
            }
        }

        return trimAndParseObject(row, ColumnGrammar)
    })
}
