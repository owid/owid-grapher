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
    trimGrid,
    intersectionOfSets,
} from "grapher/utils/Util"
import { observable, action, computed } from "mobx"
import { queryParamsToStr } from "utils/client/url"
import { CoreColumn, ColumnTypeMap } from "./CoreTableColumns"
import {
    ColumnSlug,
    ColumnTypeNames,
    CoreColumnDef,
    CoreRow,
    PrimitiveType,
    SortOrder,
    ValueRange,
} from "./CoreTableConstants"
import {
    AlignedTextTableOptions,
    toAlignedTextTable,
    toDelimited,
    toMarkdownTable,
} from "./CoreTablePrinters"
import { DroppedForTesting } from "./InvalidCells"

export enum TransformType {
    Load = "Load",
    FilterRows = "FilterRows",
    FilterColumns = "FilterColumns",
    SortRows = "SortRows",
    UpdateColumns = "UpdateColumns",
    AddRows = "AddRows",
    AddColumns = "AddColumns",
    DropValues = "DropValues",
}

// Every row will be checked against each column/value(s) pair.
interface CoreQuery {
    [columnSlug: string]: PrimitiveType | PrimitiveType[]
}

// The complex generic with default here just enables you to optionally specify a more
// narrow interface for the input rows. This is helpful for OwidTable.
export class CoreTable<
    TABLE_TYPE extends CoreTable<any>,
    ROW_TYPE extends CoreRow = CoreRow
> {
    private _inputRows: ROW_TYPE[]
    @observable.ref private _rows: ROW_TYPE[]
    @observable private _columns: Map<ColumnSlug, CoreColumn>
    @observable.shallow protected selectedRows = new Set<ROW_TYPE>()

    protected parent?: TABLE_TYPE
    private tableDescription = ""
    private transformCategory = TransformType.Load

    constructor(
        rows: ROW_TYPE[] = [],
        columnDefs: CoreColumnDef[] = [],
        parentTable?: TABLE_TYPE,
        tableDescription?: string,
        transformCategory?: TransformType
    ) {
        this._inputRows = rows // Save a reference to original rows for debugging.

        this._columns = new Map()
        columnDefs.forEach((def) => {
            const { slug, type } = def
            const ColumnType =
                (type && ColumnTypeMap[type]) || ColumnTypeMap.String
            this._columns.set(slug, new ColumnType(this, def))
        })

        // If this has a parent table, than we expect all defs. This makes "deletes" and "renames" fast.
        // If this is the first input table, then we do a simple check to generate any missing column defs.
        if (!parentTable && rows.length) this._autodetectAndAddDefs(rows)

        this.parent = parentTable
        this.tableDescription = tableDescription ?? ""
        if (transformCategory) this.transformCategory = transformCategory

        this._rows = this._buildRows(columnDefs, rows)

        // Pass selection strategy down from parent
        if (parentTable) this.copySelectionFrom(parentTable)
    }

    private _autodetectAndAddDefs(rows: ROW_TYPE[]) {
        Object.keys(rows[0])
            .filter((slug) => !this.has(slug))
            .forEach((slug) => {
                const firstRowWithValue = rows.find(
                    (row) => row[slug] !== undefined && row[slug] !== null
                )
                const def = guessColumnDef(slug, firstRowWithValue)
                const columnType = ColumnTypeMap[def.type!]
                this._columns.set(def.slug, new columnType(this, def))
            })
    }

    private _buildRows(columnDefs: CoreColumnDef[], rows: ROW_TYPE[]) {
        const firstRow = rows[0]
        const colsToParse = this.getColumnsToParse(firstRow)
        const computeds = columnDefs.filter((def) => def.fn)
        // Clone and parse rows if necessary
        if (colsToParse.length || computeds.length)
            return rows.map((row, index) => {
                const newRow: any = { ...row }
                colsToParse.forEach((col) => {
                    newRow[col.slug] = col.parse(row[col.slug])
                })
                computeds.forEach((def) => {
                    newRow[def.slug] = def.fn!(row, index)
                })
                return newRow as ROW_TYPE
            })
        return rows
    }

    copySelectionFrom(table: any) {
        // todo? Do we need a notion of selection outside of OwidTable?
    }

    // For now just examine the first row, and if anything bad is found, reparse that column
    private getColumnsToParse(firstRow: ROW_TYPE) {
        if (!firstRow) return []

        return this.columnsAsArray.filter(
            (col) => !col.isParsed(firstRow[col.slug])
        )
    }

    @computed get rows() {
        return this._rows
    }

    @computed get firstRow() {
        return this.rows[0]
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

    get rootTable(): TABLE_TYPE {
        return this.parent ? this.parent.rootTable : this
    }

    protected rowsBy<T>(columnSlug: ColumnSlug) {
        const map = new Map<T, ROW_TYPE[]>()
        this.rows.forEach((row) => {
            const key = row[columnSlug]
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(row)
        })
        return map
    }

    // todo: speed up
    filterBy(
        predicate: (row: ROW_TYPE, index: number) => boolean,
        opName: string
    ): TABLE_TYPE {
        return new (this.constructor as any)(
            this.rows.filter(predicate),
            this.defs,
            this,
            opName,
            TransformType.FilterRows
        )
    }

    sortBy(slugs: ColumnSlug[], orders?: SortOrder[]): TABLE_TYPE {
        return new (this.constructor as any)(
            orderBy(this.rows, slugs, orders),
            this.defs,
            this,
            `Sort by ${slugs.join(",")} ${orders?.join(",")}`,
            TransformType.SortRows
        )
    }

    reverse() {
        return new (this.constructor as any)(
            this.rows.slice(0).reverse(),
            this.defs,
            this,
            `Reversed row order`,
            TransformType.SortRows
        )
    }

    @computed get defs() {
        return this.columnsAsArray.map((col) => col.def)
    }

    @computed get columnNames() {
        return this.columnsAsArray.map((col) => col.name)
    }

    @computed get columnSlugs() {
        return Array.from(this._columns.keys())
    }

    @computed get lastColumnSlug() {
        return last(this.columnSlugs)!
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

        const inputTable = this._inputRows.length
            ? toAlignedTextTable(
                  Object.keys(this._inputRows[0]),
                  this._inputRows.slice(0, showRows),
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
        return this.isRoot()
            ? `${this.transformCategory}: ${this.numColumns} Columns ${this._inputRows.length} Rows`
            : `${this.transformCategory}: ${this.tableDescription}`
    }

    explain(showRows = 10, options?: AlignedTextTableOptions): string {
        return (
            (this.parent ? this.parent.explain(showRows, options) : "") +
            this.explainThis(showRows, options)
        )
    }

    explainShort(): string {
        if (!this.parent) return this.oneLiner()
        return [
            this.parent.explainShort(),
            `${this.oneLiner()} >> ${this.numColumns} Columns ${
                this.numRows
            } Rows`,
        ].join("\n")
    }

    // Output a pretty table for consles
    toAlignedTextTable() {
        return toAlignedTextTable(this.columnSlugs, this.rows)
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

    where(query: CoreQuery) {
        const rows = this.findRows(query)
        return new (this.constructor as any)(
            rows,
            this.defs,
            this,
            `Selecting ${rows.length} rows where ${queryParamsToStr(
                query as any
            )}`,
            TransformType.FilterRows
        ) as TABLE_TYPE
    }

    withRows(rows: ROW_TYPE[]): TABLE_TYPE {
        return new (this.constructor as any)(
            [...this.rows, ...rows],
            this.defs,
            this,
            `Added ${rows.length} new rows`,
            TransformType.AddRows
        )
    }

    limit(howMany: number) {
        const rows = this.rows.slice(0, howMany)
        return new (this.constructor as any)(
            rows,
            this.defs,
            this,
            `Kept the first ${rows.length} rows`,
            TransformType.FilterRows
        )
    }

    withTransformedDefs(fn: (def: CoreColumnDef) => CoreColumnDef): TABLE_TYPE {
        return new (this.constructor as any)(
            this.rows,
            this.defs.map(fn),
            this,
            `Updated column defs`,
            TransformType.UpdateColumns
        )
    }

    withoutConstantColumns(): TABLE_TYPE {
        const slugs = this.constantColumns().map((col) => col.slug)
        return this.withoutColumns(slugs, `Dropped constant columns '${slugs}'`)
    }

    withoutColumns(slugs: ColumnSlug[], message?: string): TABLE_TYPE {
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

    withRenamedColumn(currentSlug: ColumnSlug, newSlug: ColumnSlug) {
        return new (this.constructor as any)(
            this.rows,
            this.defs.map((def) =>
                def.slug === currentSlug ? { ...def, slug: newSlug } : def
            ),
            this,
            `Renamed '${currentSlug}' to '${newSlug}'`,
            TransformType.UpdateColumns
        )
    }

    withoutRows(rows: ROW_TYPE[]) {
        const set = new Set(rows)
        return this.filterBy(
            (row) => !set.has(row),
            `Dropping ${rows.length} rows`
        )
    }

    // for testing. Preserves ordering.
    dropRandomRows(howMany = 1, seed = Date.now()) {
        if (!howMany) return this // todo: clone?
        const indexesToDrop = getDropIndexes(this.numRows, howMany, seed)
        return this.filterBy(
            (row, index) => !indexesToDrop.has(index),
            `Dropping a random ${howMany} rows`
        )
    }

    dropRandomCells(
        howMany = 1,
        columnSlugs: ColumnSlug[] = [],
        seed = Date.now()
    ) {
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
                        ? new DroppedForTesting()
                        : row[col.slug],
            }
        })
        return new (this.constructor as any)(
            this.rows,
            defs,
            this,
            `Dropped ${howMany} cells in ${columnSlugs}`,
            TransformType.DropValues
        )
    }

    dropRandomPercent(dropHowMuch = 1, seed = Date.now()) {
        return this.dropRandomRows(
            Math.floor((dropHowMuch / 100) * this.numRows),
            seed
        )
    }

    filterBySelectedOnly() {
        return this.filterBy(
            (row) => this.isSelected(row),
            `Selected rows only`
        )
    }

    filterByFullColumnsOnly(slugs: ColumnSlug[]) {
        return this.filterBy(
            (row) =>
                slugs.every(
                    (slug) => row[slug] !== null && row[slug] !== undefined
                ),
            `Dropping rows missing a value for any of ${slugs.join(",")}`
        )
    }

    filterNegativesForLogScale(columnSlug: ColumnSlug) {
        return this.filterBy(
            (row) => row[columnSlug] > 0,
            `Remove rows if ${columnSlug} is <= 0 for log scale`
        )
    }

    withColumns(columns: CoreColumnDef[]): TABLE_TYPE {
        return new (this.constructor as any)(
            this.rows,
            this.defs.concat(columns),
            this,
            `Added new columns ${columns.map((def) => def.slug)}`,
            TransformType.AddColumns
        )
    }

    toMatrix() {
        return [this.columnSlugs, ...this.extract()]
    }

    static rowsFromMatrix(inputTable: Grid) {
        const table = trimGrid(inputTable)
        const header = table[0]
        return table.slice(1).map((row) => {
            const newRow: any = {}
            header.forEach((col, index) => {
                newRow[col] = row[index]
            })
            return newRow
        })
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

const guessColumnDef = (slug: string, sampleRow: any) => {
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
