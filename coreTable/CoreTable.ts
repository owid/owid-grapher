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
    Time,
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

// The complex generic with default here just enables you to optionally specify a more
// narrow interface for the input rows. This is helpful for OwidTable.
export class CoreTable<
    ROW_TYPE extends CoreRow = CoreRow,
    COL_DEF_TYPE extends CoreColumnDef = CoreColumnDef
> {
    private _inputRows: ROW_TYPE[]
    @observable.ref private _rows: ROW_TYPE[]
    @observable private _columns: Map<ColumnSlug, CoreColumn>
    @observable.shallow protected selectedRows = new Set<ROW_TYPE>()

    protected parent?: this
    tableDescription = ""
    transformCategory = TransformType.Load
    timeToLoad = 0
    private initTime = Date.now()

    constructor(
        rows: ROW_TYPE[] = [],
        incomingColumnDefs?: COL_DEF_TYPE[],
        parentTable?: CoreTable,
        tableDescription?: string,
        transformCategory?: TransformType
    ) {
        const start = Date.now()
        this._inputRows = rows // Save a reference to original rows for debugging.
        this.tableDescription = tableDescription ?? ""
        if (transformCategory) this.transformCategory = transformCategory

        this._columns = new Map()

        const colsToSet = incomingColumnDefs
            ? transformCategory === TransformType.AppendColumns && parentTable
                ? parentTable.defs.concat(incomingColumnDefs)
                : incomingColumnDefs
            : parentTable
            ? parentTable.defs
            : []
        colsToSet.forEach((def) => {
            const { slug, type } = def
            const ColumnType =
                (type && ColumnTypeMap[type]) || ColumnTypeMap.String
            this._columns.set(slug, new ColumnType(this, def))
        })

        // If this has a parent table, than we expect all defs. This makes "deletes" and "renames" fast.
        // If this is the first input table, then we do a simple check to generate any missing column defs.
        if (!parentTable && rows.length) this._autodetectAndAddDefs(rows)

        this.parent = parentTable as this

        const columnsToCompute = TransformsRequiringCompute.has(
            this.transformCategory
        )
            ? incomingColumnDefs?.filter((def) => def.fn) ?? []
            : []
        this.numColsToCompute = columnsToCompute.length
        this._rows = this._buildRows(columnsToCompute)

        // Pass selection strategy down from parent. todo: should selection be immutable as well?
        if (parentTable) this.copySelectionFrom(parentTable)
        this.timeToLoad = Date.now() - start
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

    numColsToCompute: number
    private _buildRows(columnsToCompute: COL_DEF_TYPE[]) {
        const rows = this._inputRows
        if (!this.numColsToParse && !columnsToCompute.length) return rows

        const colsToParse = this.columnsToParse

        return rows.map((row, index) => {
            const newRow: any = Object.assign({}, row)
            colsToParse.forEach((col) => {
                newRow[col.slug] = col.parse(row[col.slug])
            })
            columnsToCompute.forEach((def) => {
                newRow[def.slug] = def.fn!(row, index) // todo: add better typings around fn.
            })
            return newRow as ROW_TYPE
        })
    }

    copySelectionFrom(table: any) {
        // todo? Do we need a notion of selection outside of OwidTable?
    }

    get numColsToParse() {
        return this.columnsToParse.length
    }

    private get columnsToParse() {
        const firstRow = this._inputRows[0]
        if (!firstRow) return []

        // Don't parse computeds. They should parse themselves (todo: add some test examples of the wrong way).
        // Also don't parse columns already parsed. We approximate whether a column is parsed simply by looking at the first row. If subsequent rows
        // have a different type, that could cause problems, but the user of this library should ensure their types remain consistent throughout
        // all rows. We also consider a column parsed if the first row is of a failed parse attempt.
        return this.columnsAsArray.filter((col) => {
            return !col.def.fn && !col.isParsed(firstRow[col.slug])
        })
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
        return this._rows
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

    // todo: speed up
    filter(
        predicate: (row: ROW_TYPE, index: number) => boolean,
        opName: string
    ): this {
        return new (this.constructor as any)(
            this.rows.filter(predicate),
            undefined,
            this,
            opName,
            TransformType.FilterRows
        )
    }

    sortBy(slugs: ColumnSlug[], orders?: SortOrder[]): this {
        return new (this.constructor as any)(
            orderBy(this.rows, slugs, orders),
            undefined,
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
            undefined,
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
        return `${this.stepNumber}. ${this.transformCategory}: ${
            this.tableDescription ? this.tableDescription + ". " : ""
        }${this.numColumns} Columns ${this._inputRows.length} Rows. ${
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
            maxCharactersPerColumn: 100,
            maxCharactersPerLine: 300,
            ...options,
        })
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

    where(query: CoreQuery): this {
        const rows = this.findRows(query)
        return new (this.constructor as any)(
            rows,
            undefined,
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
            undefined,
            this,
            opDescription,
            TransformType.AppendRows
        )
    }

    limit(howMany: number): this {
        const rows = this.rows.slice(0, howMany)
        return new (this.constructor as any)(
            rows,
            undefined,
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
            undefined,
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
            `Replaced ${howMany} cells in ${columnSlugs}`,
            TransformType.UpdateRows
        )
    }

    dropRandomPercent(dropHowMuch = 1, seed = Date.now()) {
        return this.dropRandomRows(
            Math.floor((dropHowMuch / 100) * this.numRows),
            seed
        )
    }

    filterBySelectedOnly() {
        return this.filter((row) => this.isSelected(row), `Selected rows only`)
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
            defs,
            this,
            `Appended columns ${defs
                .map((def) => `'${def.slug}'`)
                .join(" and ")}`,
            TransformType.AppendColumns
        )
    }

    appendColumnsIfNew(defs: COL_DEF_TYPE[]) {
        return this.appendColumns(defs.filter((def) => !this.has(def.slug)))
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
