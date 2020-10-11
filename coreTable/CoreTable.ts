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
} from "grapher/utils/Util"
import { observable, action, computed } from "mobx"
import { CoreColumn, ColumnTypeMap } from "./CoreTableColumns"
import {
    ColumnSlug,
    ColumnTypeNames,
    CoreColumnSpec,
    CoreRow,
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
    private tableDescription?: string

    constructor(
        rows: ROW_TYPE[] = [],
        columnSpecs: CoreColumnSpec[] = [],
        parentTable?: TABLE_TYPE,
        tableDescription?: string
    ) {
        this._inputRows = rows // Save a reference to original rows for debugging.

        this._columns = new Map()
        columnSpecs.forEach((spec) => {
            const { slug, type } = spec
            const ColumnType =
                (type && ColumnTypeMap[type]) || ColumnTypeMap.String
            this._columns.set(slug, new ColumnType(this, spec))
        })

        // If this has a parent table, than we expect all specs. This makes "deletes" and "renames" fast.
        // If this is the first input table, then we do a simple check to generate any missing column specs.
        if (!parentTable && rows.length) this._autodetectAndSpecs(rows)

        this.parent = parentTable
        this.tableDescription = tableDescription

        this._rows = this._buildRows(columnSpecs, rows)

        // Pass selection strategy down from parent
        if (parentTable) this.copySelectionFrom(parentTable)
    }

    private _autodetectAndSpecs(rows: ROW_TYPE[]) {
        Object.keys(rows[0])
            .filter((slug) => !this.has(slug))
            .forEach((slug) => {
                const firstRowWithValue = rows.find(
                    (row) => row[slug] !== undefined && row[slug] !== null
                )
                const spec = guessColumnSpec(slug, firstRowWithValue)
                const columnType = ColumnTypeMap[spec.type!]
                this._columns.set(spec.slug, new columnType(this, spec))
            })
    }

    private _buildRows(columnSpecs: CoreColumnSpec[], rows: ROW_TYPE[]) {
        const firstRow = rows[0]
        const colsToParse = this.getColumnsToParse(firstRow)
        const computeds = columnSpecs.filter((spec) => spec.fn)
        // Clone and parse rows if necessary
        if (colsToParse.length || computeds.length)
            return rows.map((row, index) => {
                const newRow: any = { ...row }
                colsToParse.forEach((col) => {
                    newRow[col.slug] = col.parse(row[col.slug])
                })
                computeds.forEach((spec) => {
                    newRow[spec.slug] = spec.fn!(row, index)
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
            this.specs,
            this,
            opName
        )
    }

    sortBy(slugs: ColumnSlug[], orders?: SortOrder[]): TABLE_TYPE {
        return new (this.constructor as any)(
            orderBy(this.rows, slugs, orders),
            this.specs,
            this,
            `Sort by ${slugs.join(",")} ${orders?.join(",")}`
        )
    }

    reverse() {
        return new (this.constructor as any)(
            this.rows.slice(0).reverse(),
            this.specs,
            this,
            `Reversed row order`
        )
    }

    @computed get specs() {
        return this.columnsAsArray.map((col) => col.spec)
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
                type: col.spec.type,
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

        const originalRows = !this.isRoot()
            ? `\n\n\n\n\n\n## ${this.tableDescription || ""}:\n\n`
            : `Input Data: ${this._inputRows.length} Rows \n\n${inputTable}\n\n\n\n# Root Table:\n`

        return [
            originalRows,
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

    explain(showRows = 10, options?: AlignedTextTableOptions): string {
        return (
            (this.parent ? this.parent.explain(showRows, options) : "") +
            this.explainThis(showRows, options)
        )
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

    withRows(rows: ROW_TYPE[]): TABLE_TYPE {
        return new (this.constructor as any)(
            [...this.rows, ...rows],
            this.specs,
            this,
            `Added ${rows.length} new rows`
        )
    }

    limit(howMany: number) {
        const rows = this.rows.slice(0, howMany)
        return new (this.constructor as any)(
            rows,
            this.specs,
            this,
            `Kept the first ${rows.length} rows`
        )
    }

    identity() {
        return new (this.constructor as any)(
            this.rows,
            this.specs,
            this,
            `Cloned table`
        )
    }

    withTransformedSpecs(
        fn: (spec: CoreColumnSpec) => CoreColumnSpec
    ): TABLE_TYPE {
        return new (this.constructor as any)(
            this.rows,
            this.specs.map(fn),
            this,
            `Updated column specs`
        )
    }

    withoutConstantColumns(): TABLE_TYPE {
        const slugs = this.constantColumns().map((col) => col.slug)
        return this.withoutColumns(slugs, `Dropped constant columns '${slugs}'`)
    }

    withoutColumns(slugs: ColumnSlug[], message?: string): TABLE_TYPE {
        const columnsToDrop = new Set(slugs)
        const specs = this.columnsAsArray
            .filter((col) => !columnsToDrop.has(col.slug))
            .map((col) => col.spec)
        return new (this.constructor as any)(
            this.rows,
            specs,
            this,
            message ?? `Dropped columns '${slugs}'`
        )
    }

    withRenamedColumn(currentSlug: ColumnSlug, newSlug: ColumnSlug) {
        return new (this.constructor as any)(
            this.rows,
            this.specs.map((spec) =>
                spec.slug === currentSlug ? { ...spec, slug: newSlug } : spec
            ),
            this,
            `Renamed '${currentSlug}' to '${newSlug}'`
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
        const specs = this.columnsAsArray.map((col) => {
            const { spec } = col
            if (!columnSlugs.includes(col.slug)) return spec
            const indexesToDrop = getDropIndexes(
                col.parsedValues.length,
                howMany,
                seed
            )
            return {
                ...spec,
                fn: (row: ROW_TYPE, index: number) =>
                    indexesToDrop.has(index)
                        ? new DroppedForTesting()
                        : row[col.slug],
            }
        })
        return new (this.constructor as any)(
            this.rows,
            specs,
            this,
            `Dropped ${howMany} cells in ${columnSlugs}`
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

    // todo: how do I make this generic and on CoreTable?
    withColumns(columns: CoreColumnSpec[]): TABLE_TYPE {
        return new (this.constructor as any)(
            this.rows,
            this.specs.concat(columns),
            this,
            `Added new columns ${columns.map((spec) => spec.slug)}`
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

    specToObject() {
        const output: any = {}
        this.columnsAsArray.forEach((col) => {
            output[col.slug] = col.spec
        })
        return output
    }

    toJs() {
        return {
            columns: this.specToObject(),
            rows: this.rows,
        }
    }

    static fromDelimited(csvOrTsv: string, specs?: CoreColumnSpec[]) {
        return new CoreTable(standardizeSlugs(parseDelimited(csvOrTsv)), specs)
    }
}

const guessColumnSpec = (slug: string, sampleRow: any) => {
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
    const colSpecs = Object.keys(rows[0]).map((name) => {
        return {
            name,
            slug: slugifySameCase(name),
        }
    })
    const colsToRename = colSpecs.filter((col) => col.name !== col.slug)
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
