import { trimObject } from "../clientUtils/Util"
import { GitCommit, SubNavId } from "../clientUtils/owidTypes"
import {
    DefaultNewExplorerSlug,
    ExplorerChoiceParams,
    EXPLORERS_ROUTE_FOLDER,
} from "./ExplorerConstants"
import {
    columnDefinitionsFromDelimited,
    CoreTable,
} from "../coreTable/CoreTable"
import {
    CoreMatrix,
    CoreTableInputOption,
    TableSlug,
} from "../coreTable/CoreTableConstants"
import { ExplorerGrammar } from "./ExplorerGrammar"
import {
    CellDef,
    GridBoolean,
    GRID_CELL_DELIMITER,
    GRID_NODE_DELIMITER,
    Grammar,
    RootKeywordCellDef,
} from "../gridLang/GridLangConstants"
import { OwidTable } from "../coreTable/OwidTable"
import { GridProgram } from "../gridLang/GridProgram"
import { SerializedGridProgram } from "../clientUtils/owidTypes"
import { GrapherInterface } from "../grapher/core/GrapherInterface"
import { GrapherGrammar } from "./GrapherGrammar"
import { ColumnGrammar } from "./ColumnGrammar"
import { DecisionMatrix } from "./ExplorerDecisionMatrix"
import { CoreColumnDef } from "../coreTable/CoreColumnDef"
import { PromiseCache } from "../clientUtils/PromiseCache"
import { FacetAxisRange } from "../grapher/core/GrapherConstants"

export const EXPLORER_FILE_SUFFIX = ".explorer.tsv"

export interface TableDef {
    url?: string
    columnDefinitions?: CoreColumnDef[]
    inlineData?: string
}

interface ExplorerGrapherInterface extends GrapherInterface {
    grapherId?: number
    tableSlug?: string
    yScaleToggle?: boolean
    yAxisMin?: number
    facetYRange?: FacetAxisRange
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
        return this.getLine(ExplorerGrammar.selection.keyword)
            ?.split(this.cellDelimiter)
            .slice(1)
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

    get tableSlugs(): (TableSlug | undefined)[] {
        return this.lines
            .filter((line) => line.startsWith(ExplorerGrammar.table.keyword))
            .map((line) => line.split(this.cellDelimiter)[2])
    }

    get columnDefsByTableSlug(): Map<TableSlug | undefined, CoreColumnDef[]> {
        const result = new Map<TableSlug | undefined, CoreColumnDef[]>()
        this.tableSlugs.forEach((tableSlug) => {
            const tableDef = this.getTableDef(tableSlug)
            if (tableDef && tableDef.columnDefinitions) {
                result.set(tableSlug, tableDef.columnDefinitions)
            }
        })
        return result
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

        const table = await clone.constructTable(tableSlug)

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

    get grapherConfig(): ExplorerGrapherInterface {
        const rootObject = trimAndParseObject(this.tuplesObject, GrapherGrammar)

        Object.keys(rootObject).forEach((key) => {
            if (!GrapherGrammar[key]) delete rootObject[key]
        })

        const selectedGrapherRow = this.decisionMatrix.selectedRow
        if (selectedGrapherRow && Object.keys(selectedGrapherRow).length) {
            return { ...rootObject, ...selectedGrapherRow }
        }

        return rootObject
    }

    /**
     * A static method so that all explorers on the page share requests,
     * and no duplicate requests are sent.
     */
    private static tableDataLoader = new PromiseCache(
        async (url: string): Promise<CoreTableInputOption> => {
            const response = await fetch(url)
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

        const columnDefinitions: CoreColumnDef[] | undefined =
            colDefsRow !== -1
                ? columnDefinitionsFromDelimited(
                      this.getBlock(colDefsRow)
                  ).map((row) => trimAndParseObject(row, ColumnGrammar))
                : undefined

        return {
            url,
            columnDefinitions,
            inlineData,
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
