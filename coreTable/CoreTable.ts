import {
    formatYear,
    csvEscape,
    parseDelimited,
    slugifySameCase,
    min,
    max,
    last,
    orderBy,
    getDropIndexes,
    Grid,
    intersectionOfSets,
    rowsFromGrid,
    range,
    difference,
} from "grapher/utils/Util"
import { observable, action, computed } from "mobx"
import { queryParamsToStr } from "utils/client/url"
import { CoreColumn, ColumnTypeMap } from "./CoreTableColumns"
import {
    ColumnSlug,
    ColumnTypeNames,
    CoreColumnDef,
    CoreRow,
    JsTypes,
    PrimitiveType,
    SortOrder,
    TransformType,
    ValueRange,
} from "./CoreTableConstants"
import {
    AlignedTextTableOptions,
    toAlignedTextTable,
    toDelimited,
    toMarkdownTable,
} from "./CoreTablePrinters"
import { DroppedForTesting, InvalidOnALogScale } from "./InvalidCells"

// Every row will be checked against each column/value(s) pair.
interface CoreQuery {
    [columnSlug: string]: PrimitiveType | PrimitiveType[]
}

const TransformsRequiringCompute = new Set([
    TransformType.Load,
    TransformType.AppendRows,
    TransformType.AppendColumns,
    TransformType.UpdateRows,
])

abstract class StorageEngine<ROW_TYPE extends CoreRow = CoreRow> {
    abstract get rows(): ROW_TYPE[]
    abstract get inputRows(): ROW_TYPE[]
}

class RowStorageEngine<
    ROW_TYPE extends CoreRow = CoreRow
> extends StorageEngine<ROW_TYPE> {
    private _inputRows: ROW_TYPE[]
    private builtRows: ROW_TYPE[]
    private table: CoreTable
    @computed get numColsToCompute() {
        return this.colsToCompute.length
    }
    @computed get numColsToParse() {
        return this.columnsToParse.length
    }
    constructor(rows: ROW_TYPE[] = [], table: CoreTable) {
        super()
        this._inputRows = rows
        this.table = table
        this.builtRows = rows

        if (this.needsBuilding) this.buildRows()
    }

    private buildRows() {
        this.builtRows = this._inputRows.map((row, index) => {
            const newRow: any = Object.assign({}, row)
            this.columnsToParse.forEach((col) => {
                newRow[col.slug] = col.parse(row[col.slug])
            })
            this.colsToCompute.forEach((def) => {
                newRow[def.slug] = def.fn!(row, index) // todo: add better typings around fn.
            })
            return newRow as ROW_TYPE
        })
    }

    private get needsBuilding() {
        return this.colsToCompute.length || this.columnsToParse.length
    }

    private get colsToCompute() {
        // We never need to compute on certain transforms
        if (!TransformsRequiringCompute.has(this.table.transformCategory))
            return []

        // Only compute new columns
        return this.table.newColumnDefs.filter((def) => def.fn)
    }

    private get columnsToParse() {
        const firstRow = this._inputRows[0]
        if (!firstRow) return []
        const cols = this.table.columnsAsArray

        // The default behavior is to assume some missing or bad data in user data, so we always parse the full input the first time we load
        // user data. Todo: measure the perf hit and add a parameter to opt out of this this if you know the data is complete?
        if (this.table.isRoot()) return cols

        return cols.filter((col) => col.needsParsing(firstRow[col.slug]))
    }

    get inputRows() {
        return this._inputRows
    }

    get rows() {
        return this.builtRows
    }
}

class ColumnStorageEngine<
    ROW_TYPE extends CoreRow = CoreRow
> extends StorageEngine<ROW_TYPE> {
    private columnVectors: JsTypes[][]
    private columnSlugs: ColumnSlug[]
    constructor(
        columnVectors: JsTypes[][] = [],
        columnSlugs: ColumnSlug[] = []
    ) {
        super()
        this.columnVectors = columnVectors
        this.columnSlugs = columnSlugs
    }

    // todo: fix for built.
    get inputRows() {
        return this.rows
    }

    private makeRowFor(rowIndex: number) {
        const row: any = {}
        this.columnSlugs.forEach((slug, colIndex) => {
            row[slug] = this.columnVectors[colIndex][rowIndex]
        })
        return row as ROW_TYPE
    }

    @computed private get length() {
        return this.columnVectors[0]?.length ?? 0
    }

    get rows() {
        return range(0, this.length).map((index) => this.makeRowFor(index))
    }
}

// The complex generic with default here just enables you to optionally specify a more
// narrow interface for the input rows. This is helpful for OwidTable.
export class CoreTable<
    ROW_TYPE extends CoreRow = CoreRow,
    COL_DEF_TYPE extends CoreColumnDef = CoreColumnDef
> {
    @observable private _columns: Map<ColumnSlug, CoreColumn> = new Map()
    @observable.shallow protected selectedRows = new Set<ROW_TYPE>()

    protected parent?: this
    tableDescription: string
    transformCategory: TransformType
    timeToLoad = 0
    private initTime = Date.now()

    private storageEngine: StorageEngine

    inputColumnDefs: COL_DEF_TYPE[]
    constructor(
        rows: ROW_TYPE[] = [],
        inputColumnDefs: COL_DEF_TYPE[] = [],
        parent?: CoreTable,
        tableDescription = "",
        transformCategory = TransformType.Load
    ) {
        const start = Date.now() // Perf aid

        this.tableDescription = tableDescription
        this.transformCategory = transformCategory
        this.parent = parent as this
        this.inputColumnDefs = inputColumnDefs
        this.inputColumnDefs.forEach((def) => this.setColumn(def))

        // If this has a parent table, than we expect all defs. This makes "deletes" and "renames" fast.
        // If this is the first input table, then we do a simple check to generate any missing column defs.
        if (!parent && rows.length)
            this.autodetectAndAddColumnsFromFirstRow(rows)

        const isRows = true
        this.storageEngine = isRows
            ? new RowStorageEngine<ROW_TYPE>(rows, this)
            : new ColumnStorageEngine<ROW_TYPE>()

        // Pass selection strategy down from parent. todo: move selection to Grapher.
        if (parent) this.copySelectionFrom(parent)

        this.timeToLoad = Date.now() - start // Perf aid
    }

    private setColumn(def: COL_DEF_TYPE) {
        const { type, slug } = def
        const ColumnType = (type && ColumnTypeMap[type]) ?? ColumnTypeMap.String
        this._columns.set(slug, new ColumnType(this, def))
    }

    private autodetectAndAddColumnsFromFirstRow(rows: ROW_TYPE[]) {
        Object.keys(rows[0])
            .filter((slug) => !this.has(slug))
            .forEach((slug) => {
                const firstRowWithValue = rows.find(
                    (row) => row[slug] !== undefined && row[slug] !== null
                )
                const def = guessColumnDefFromSlugAndRow(
                    slug,
                    firstRowWithValue
                ) as COL_DEF_TYPE
                this.setColumn(def)
            })
    }
    copySelectionFrom(table: any) {
        // todo? Do we need a notion of selection outside of OwidTable?
    }

    @computed get newColumnDefs() {
        if (!this.parent) return this.inputColumnDefs
        return difference(this.inputColumnDefs, this.parent.defs)
    }

    get stepNumber(): number {
        return !this.parent ? 0 : this.parent.stepNumber + 1
    }

    get totalTime(): number {
        return this.timeToLoad + (this.parent ? this.parent.totalTime : 0)
    }

    get elapsedTime(): number {
        return this.initTime + this.timeToLoad - this.rootTable.initTime
    }

    // Time between when the parent table finished loading and this table started constructing.
    // A large time may just be due to a transform only happening after a user action, or it
    // could be do to other sync code executing between transforms.
    get betweenTime(): number {
        return this.parent
            ? this.initTime - (this.parent.initTime + this.parent.timeToLoad)
            : 0
    }

    @computed get rows() {
        return this.storageEngine.rows as ROW_TYPE[]
    }

    @computed get firstRow() {
        return this.rows[0]
    }

    @computed get lastRow() {
        return last(this.rows)
    }

    @computed get numRows() {
        return this.rows.length
    }

    @computed get numColumns() {
        return this.columnSlugs.length
    }

    get(columnSlug?: ColumnSlug) {
        return columnSlug !== undefined
            ? this._columns.get(columnSlug)
            : undefined
    }

    has(columnSlug: ColumnSlug) {
        return this._columns.has(columnSlug)
    }

    // TODO: remove this. Currently we use this to get the right day/year time formatting. For now a chart is either a "day chart" or a "year chart".
    // But we can have charts with multiple time columns. Ideally each place that needs access to the timeColumn, would get the specific column
    // and not the first time column from the table.
    @computed get timeColumn() {
        // For now, return a day column first if present. But see note above about removing this method.
        const col =
            this.columnsAsArray.find(
                (col) => col instanceof ColumnTypeMap.Date
            ) ||
            this.columnsAsArray.find((col) => col instanceof ColumnTypeMap.Year)
        return col!
    }

    // Todo: remove this. Generally this should not be called until the data is loaded. Even then, all calls should probably be made
    // on the column itself, and not tied tightly to the idea of a time column.
    @computed get timeColumnFormatFunction() {
        return this.timeColumn ? this.timeColumn.formatValue : formatYear
    }

    formatTime(value: any) {
        return this.timeColumnFormatFunction(value)
    }

    @computed private get columnsWithParseErrors() {
        return this.columnsAsArray.filter((col) => col.numParseErrors)
    }

    @computed get numColumnsWithParseErrors() {
        return this.columnsWithParseErrors.length
    }

    @computed get hasParseErrors() {
        return this.numColumnsWithParseErrors
    }

    get rootTable(): this {
        return this.parent ? this.parent.rootTable : this
    }

    protected rowsBy<T>(columnSlug: ColumnSlug) {
        const map = new Map<T, ROW_TYPE[]>()
        this.rows.forEach((row) => {
            const value = row[columnSlug]
            if (!map.has(value)) map.set(value, [])
            map.get(value)!.push(row)
        })
        return map
    }

    grep(searchStringOrRegex: string | RegExp) {
        return this.filter((row) => {
            const line = Object.values(row).join(" ")
            return typeof searchStringOrRegex === "string"
                ? line.includes(searchStringOrRegex)
                : searchStringOrRegex.test(line)
        }, `Kept rows that matched '${searchStringOrRegex.toString()}'`)
    }

    @computed get rowsAsSet() {
        return new Set(this.rows)
    }

    @computed get opposite(): this {
        if (this.isRoot()) return this
        const { rowsAsSet } = this
        return new (this.constructor as any)(
            this.parent!.rows.filter((row) => !rowsAsSet.has(row)),
            this.defs,
            this,
            `Inversing previous filter`,
            TransformType.InverseFilterRows
        )
    }

    @computed get oppositeColumns(): this {
        if (this.isRoot()) return this
        const columnsToDrop = new Set(this.columnSlugs)
        const defs = this.parent!.columnsAsArray.filter(
            (col) => !columnsToDrop.has(col.slug)
        ).map((col) => col.def)
        return new (this.constructor as any)(
            this.rows,
            defs,
            this,
            `Inversing previous column filter`,
            TransformType.InverseFilterColumns
        )
    }

    grepColumns(searchStringOrRegex: string | RegExp) {
        const columnsToDrop = this.columnSlugs.filter((slug) => {
            return typeof searchStringOrRegex === "string"
                ? !slug.includes(searchStringOrRegex)
                : !searchStringOrRegex.test(slug)
        })

        return this.withoutColumns(
            columnsToDrop,
            `Kept ${
                this.columnSlugs.length - columnsToDrop.length
            } columns that matched '${searchStringOrRegex.toString()}'.`
        )
    }

    // todo: speed up
    filter(
        predicate: (row: ROW_TYPE, index: number) => boolean,
        opName: string
    ): this {
        return new (this.constructor as any)(
            this.rows.filter(predicate),
            this.defs,
            this,
            opName,
            TransformType.FilterRows
        )
    }

    sortBy(slugs: ColumnSlug[], orders?: SortOrder[]): this {
        return new (this.constructor as any)(
            orderBy(this.rows, slugs, orders),
            this.defs,
            this,
            `Sort by ${slugs.join(",")} ${orders?.join(",")}`,
            TransformType.SortRows
        )
    }

    sortColumns(slugs: ColumnSlug[]): this {
        const first = this.getColumns(slugs)
        const rest = this.columnsAsArray.filter((col) => !first.includes(col))
        return new (this.constructor as any)(
            this.rows,
            [...first, ...rest],
            this,
            `Sorted columns`,
            TransformType.SortColumns
        )
    }

    reverse(): this {
        return new (this.constructor as any)(
            this.rows.slice(0).reverse(),
            this.defs,
            this,
            `Reversed row order`,
            TransformType.SortRows
        )
    }

    @computed get defs() {
        return this.columnsAsArray.map((col) => col.def) as COL_DEF_TYPE[]
    }

    @computed get columnNames() {
        return this.columnsAsArray.map((col) => col.name)
    }

    @computed get columnSlugs() {
        return Array.from(this._columns.keys())
    }

    @computed get numericColumnSlugs() {
        return this.columnsAsArray
            .filter((col) => col instanceof ColumnTypeMap.Numeric)
            .map((col) => col.slug)
    }

    isSelected(row: ROW_TYPE) {
        return this.selectedRows.has(row)
    }

    @action.bound selectRows(rows: ROW_TYPE[]) {
        rows.forEach((row) => {
            this.selectedRows.add(row)
        })
        return this
    }

    @action.bound selectAll() {
        return this.selectRows(this.rows)
    }

    @action.bound deselectRows(rows: ROW_TYPE[]) {
        rows.forEach((row) => {
            this.selectedRows.delete(row)
        })
        return this
    }

    @computed protected get unselectedRows() {
        return this.rows.filter((row) => !this.selectedRows.has(row))
    }

    @computed get hasSelection() {
        return this.selectedRows.size > 0
    }

    @action.bound clearSelection() {
        this.selectedRows.clear()
        return this
    }

    @computed get columnsAsArray() {
        return Array.from(this._columns.values())
    }

    getColumns(slugs: ColumnSlug[]) {
        return slugs.map((slug) => this.get(slug)!)
    }

    // Get the min and max for multiple columns at once
    domainFor(slugs: ColumnSlug[]): ValueRange {
        const cols = this.getColumns(slugs)
        const mins = cols.map((col) => col.minValue)
        const maxes = cols.map((col) => col.maxValue)
        return [min(mins), max(maxes)]
    }

    extract(slugs = this.columnSlugs) {
        return this.rows.map((row) => slugs.map((slug) => row[slug] ?? ""))
    }

    isRoot() {
        return !this.parent
    }

    @computed private get inputRows() {
        return this.storageEngine.inputRows
    }

    explainThis(showRows = 10, options?: AlignedTextTableOptions): string {
        const rowCount = this.numRows
        const showRowsClamped = showRows > rowCount ? rowCount : showRows
        const colTable = this.columnsAsArray.map((col) => {
            return {
                slug: col.slug,
                type: col.def.type,
                jsType: col.jsType,
                name: col.name,
                count: col.numValues,
            }
        })

        const inputTable = this.inputRows.length
            ? toAlignedTextTable(
                  Object.keys(this.inputRows[0]),
                  this.inputRows.slice(0, showRows),
                  options
              )
            : ""

        const tableDescription = this.isRoot()
            ? `${this.oneLiner()}\n\n${inputTable}\n\n\n\n# Root Table:\n`
            : `\n\n\n\n\n\n## ${this.oneLiner()}\n\n`

        return [
            tableDescription,
            `${this.numColumns} Columns. ${rowCount} Rows. ${showRowsClamped} shown below. ${this.selectedRows.size} selected. \n`,
            toAlignedTextTable(
                ["slug", "type", "jsType", "name", "count"],
                colTable,
                options
            ) + "\n\n",
            toAlignedTextTable(
                this.columnSlugs,
                this.rows.slice(0, showRowsClamped),
                options
            ),
        ].join("")
    }

    private oneLiner() {
        return `${this.stepNumber}. ${this.transformCategory}: ${
            this.tableDescription ? this.tableDescription + ". " : ""
        }${this.numColumns} Columns ${this.inputRows.length} Rows. ${
            this.timeToLoad
        }ms.`
    }

    private get ancestors(): this[] {
        return this.parent ? [...this.parent.ancestors, this] : [this]
    }

    explain(showRows = 10, options?: AlignedTextTableOptions): string {
        return (
            (this.parent ? this.parent.explain(showRows, options) : "") +
            this.explainThis(showRows, options)
        )
    }

    @computed get numColsToCompute() {
        return this.storageEngine instanceof RowStorageEngine
            ? this.storageEngine.numColsToCompute
            : 0
    }

    @computed get numColsToParse() {
        return this.storageEngine instanceof RowStorageEngine
            ? this.storageEngine.numColsToParse
            : 0
    }

    explainShort(options?: AlignedTextTableOptions) {
        type CoreTableGetter = keyof CoreTable
        const header: CoreTableGetter[] = [
            "stepNumber",
            "transformCategory",
            "numColumns",
            "numRows",
            "timeToLoad",
            "betweenTime",
            "numColsToParse",
            "numColsToCompute",
            "tableDescription",
        ]
        return toAlignedTextTable(header, this.ancestors, {
            maxCharactersPerColumn: 50,
            maxCharactersPerLine: 200,
            ...options,
        })
    }

    // Output a pretty table for consles
    toAlignedTextTable(options?: AlignedTextTableOptions) {
        return toAlignedTextTable(this.columnSlugs, this.rows, options)
    }

    toMarkdownTable() {
        return toMarkdownTable(this.columnSlugs, this.rows)
    }

    toDelimited(
        delimiter: string = ",",
        columnSlugs = this.columnSlugs,
        rows = this.rows
    ) {
        return toDelimited(delimiter, columnSlugs, rows)
    }

    toCsvWithColumnNames() {
        const delimiter = ","
        const header =
            this.columnsAsArray
                .map((col) => csvEscape(col.name))
                .join(delimiter) + "\n"
        const body = this.rows
            .map((row) =>
                this.columnsAsArray.map(
                    (col) => col.formatForCsv(row[col.slug]) ?? ""
                )
            )
            .map((row) => row.join(delimiter))
            .join("\n")
        return header + body
    }

    // Get all the columns that only have 1 value
    constantColumns() {
        return this.columnsAsArray.filter((col) => col.isConstant)
    }

    findRows(query: CoreQuery) {
        const slugs = Object.keys(query)
        if (!slugs.length) return this.rows
        const sets = this.getColumns(slugs).map((col) =>
            col.rowsWhere(query[col.slug])
        )
        return Array.from(intersectionOfSets(sets))
    }

    indexOf(row: ROW_TYPE) {
        return this.rows.indexOf(row)
    }

    where(query: CoreQuery): this {
        const rows = this.findRows(query)
        return new (this.constructor as any)(
            rows,
            this.defs,
            this,
            `Selecting ${rows.length} rows where ${queryParamsToStr(
                query as any
            ).substr(1)}`,
            TransformType.FilterRows
        )
    }

    withRows(rows: ROW_TYPE[], opDescription: string): this {
        return new (this.constructor as any)(
            [...this.rows, ...rows],
            this.defs,
            this,
            opDescription,
            TransformType.AppendRows
        )
    }

    limit(howMany: number): this {
        const rows = this.rows.slice(0, howMany)
        return new (this.constructor as any)(
            rows,
            this.defs,
            this,
            `Kept the first ${rows.length} rows`,
            TransformType.FilterRows
        )
    }

    withTransformedDefs(fn: (def: COL_DEF_TYPE) => COL_DEF_TYPE): this {
        return new (this.constructor as any)(
            this.rows,
            this.defs.map(fn),
            this,
            `Updated column defs`,
            TransformType.UpdateColumnDefs
        )
    }

    withoutConstantColumns(): this {
        const slugs = this.constantColumns().map((col) => col.slug)
        return this.withoutColumns(slugs, `Dropped constant columns '${slugs}'`)
    }

    withoutColumns(slugs: ColumnSlug[], message?: string): this {
        const columnsToDrop = new Set(slugs)
        const defs = this.columnsAsArray
            .filter((col) => !columnsToDrop.has(col.slug))
            .map((col) => col.def)
        return new (this.constructor as any)(
            this.rows,
            defs,
            this,
            message ?? `Dropped columns '${slugs}'`,
            TransformType.FilterColumns
        )
    }

    // Todo: improve typings. After renaming a column the row interface should change. Applies to some other methods as well.
    withRenamedColumns(columnRenameMap: {
        [columnSlug: string]: ColumnSlug
    }): this {
        const oldSlugs = Object.keys(columnRenameMap)
        const newSlugs = Object.values(columnRenameMap)

        const message =
            `Renamed ` +
            oldSlugs
                .map((name, index) => `'${name}' to '${newSlugs[index]}'`)
                .join(" and ")

        return new (this.constructor as any)(
            this.rows.map((row) => {
                const newRow: any = { ...row }
                newSlugs.forEach(
                    (slug, index) => (newRow[slug] = row[oldSlugs[index]])
                )
                oldSlugs.forEach((slug) => delete newRow[slug])
                return newRow
            }),
            this.defs.map((def) =>
                oldSlugs.indexOf(def.slug) > -1
                    ? {
                          ...def,
                          slug: newSlugs[oldSlugs.indexOf(def.slug)],
                      }
                    : def
            ),
            this,
            message,
            TransformType.RenameColumns
        )
    }

    withoutRows(rows: ROW_TYPE[]) {
        const set = new Set(rows)
        return this.filter(
            (row) => !set.has(row),
            `Dropping ${rows.length} rows`
        )
    }

    // for testing. Preserves ordering.
    dropRandomRows(howMany = 1, seed = Date.now()) {
        if (!howMany) return this // todo: clone?
        const indexesToDrop = getDropIndexes(this.numRows, howMany, seed)
        return this.filter(
            (row, index) => !indexesToDrop.has(index),
            `Dropping a random ${howMany} rows`
        )
    }

    replaceNonPositiveCellsForLogScale(columnSlugs: ColumnSlug[] = []) {
        let replacedCellCount = 0
        const newRows = this.rows.map((row) => {
            const values = columnSlugs.map((slug) => row[slug])
            if (values.every((value) => value > 0)) return row
            const newRow: any = { ...row }
            values.forEach((value, index) => {
                const slug = columnSlugs[index]
                if (value <= 0) {
                    newRow[slug] = new InvalidOnALogScale()
                    replacedCellCount++
                }
            })
            return newRow
        })
        return new (this.constructor as any)(
            newRows,
            this.defs,
            this,
            `Replaced ${replacedCellCount} negative or zero cells across columns ${columnSlugs.join(
                " and "
            )}`,
            TransformType.UpdateRows
        )
    }

    replaceRandomCells(
        howMany = 1,
        columnSlugs: ColumnSlug[] = [],
        seed = Date.now(),
        replacementGenerator: () => any = () => new DroppedForTesting()
    ): this {
        // todo: instead of doing column fns just mutate rows and pass the new rows?
        const defs = this.columnsAsArray.map((col) => {
            const { def } = col
            if (!columnSlugs.includes(col.slug)) return def
            const indexesToDrop = getDropIndexes(
                col.parsedValues.length,
                howMany,
                seed
            )
            return {
                ...def,
                fn: (row: ROW_TYPE, index: number) =>
                    indexesToDrop.has(index)
                        ? replacementGenerator()
                        : row[col.slug],
            }
        })
        return new (this.constructor as any)(
            this.rows,
            defs,
            this,
            `Replaced a random ${howMany} cells in ${columnSlugs.join(
                " and "
            )}`,
            TransformType.UpdateRows
        )
    }

    dropRandomPercent(dropHowMuch = 1, seed = Date.now()) {
        return this.dropRandomRows(
            Math.floor((dropHowMuch / 100) * this.numRows),
            seed
        )
    }

    isGreaterThan(columnSlug: ColumnSlug, value: PrimitiveType) {
        return this.filter(
            (row) => row[columnSlug] > value,
            `Filter where ${columnSlug} > ${value}`
        )
    }

    filterBySelectedOnly() {
        return this.filter(
            (row) => this.isSelected(row),
            `Keep selected rows only`
        )
    }

    filterByFullColumnsOnly(slugs: ColumnSlug[]) {
        return this.filter(
            (row) =>
                slugs.every(
                    (slug) => row[slug] !== null && row[slug] !== undefined
                ),
            `Dropping rows missing a value for any of ${slugs.join(",")}`
        )
    }

    filterNegativesForLogScale(columnSlug: ColumnSlug) {
        return this.filter(
            (row) => row[columnSlug] > 0,
            `Remove rows if ${columnSlug} is <= 0 for log scale`
        )
    }

    appendColumns(defs: COL_DEF_TYPE[]): this {
        return new (this.constructor as any)(
            this.rows,
            this.defs.concat(defs),
            this,
            `Appended columns ${defs
                .map((def) => `'${def.slug}'`)
                .join(" and ")}`,
            TransformType.AppendColumns
        )
    }

    // Update the table from an array of arrays (method created for loading data from Handsontable)
    // For now does a dumb overwrite
    reloadFromGrid(inputTable: Grid) {
        const rows = rowsFromGrid(inputTable)
        return new (this.constructor as any)(
            rows,
            this.defs,
            this,
            `Reloaded ${rows.length} rows`,
            TransformType.Reload
        )
    }

    transpose(
        by: ColumnSlug,
        columnTypeNameForNewColumns = ColumnTypeNames.Numeric
    ) {
        const newColumnSlugs = [by, ...this.get(by)!.uniqValues]
        const newColumnDefs = newColumnSlugs.map((slug) => {
            if (slug === by) return { slug }
            return {
                type: columnTypeNameForNewColumns,
                slug,
            }
        })
        const newRowValues = this.columnsAsArray
            .filter((col) => col.slug !== by)
            .map((col) => [col.slug, ...col.allValues])
        return new (this.constructor as any)(
            rowsFromGrid([newColumnSlugs, ...newRowValues]),
            newColumnDefs,
            this,
            `Transposed`,
            TransformType.Transpose
        )
    }

    appendColumnsIfNew(defs: COL_DEF_TYPE[]) {
        return this.appendColumns(defs.filter((def) => !this.has(def.slug)))
    }

    toMatrix() {
        return [this.columnSlugs, ...this.extract()]
    }

    defToObject() {
        const output: any = {}
        this.columnsAsArray.forEach((col) => {
            output[col.slug] = col.def
        })
        return output
    }

    toJs() {
        return {
            columns: this.defToObject(),
            rows: this.rows,
        }
    }

    static fromDelimited(csvOrTsv: string, defs?: CoreColumnDef[]) {
        return new CoreTable(standardizeSlugs(parseDelimited(csvOrTsv)), defs)
    }
}

const guessColumnDefFromSlugAndRow = (
    slug: string,
    sampleRow: any
): CoreColumnDef => {
    if (slug === "day")
        return {
            slug: "day",
            type: ColumnTypeNames.Date,
            name: "Date",
        }

    if (slug === "year")
        return {
            slug: "year",
            type: ColumnTypeNames.Year,
            name: "Year",
        }

    const value = sampleRow[slug]

    if (typeof value === "number")
        return {
            slug,
            type: ColumnTypeNames.Numeric,
        }

    if (typeof value === "string") {
        if (value.match(/^\d+$/))
            return {
                slug,
                type: ColumnTypeNames.Numeric,
            }
    }

    return { slug, type: ColumnTypeNames.String }
}

const standardizeSlugs = (rows: CoreRow[]) => {
    const defs = Object.keys(rows[0]).map((name) => {
        return {
            name,
            slug: slugifySameCase(name),
        }
    })
    const colsToRename = defs.filter((col) => col.name !== col.slug)
    if (colsToRename.length) {
        rows.forEach((row: CoreRow) => {
            colsToRename.forEach((col) => {
                row[col.slug] = row[col.name]
                delete row[col.name]
            })
        })
    }
    return rows
}
