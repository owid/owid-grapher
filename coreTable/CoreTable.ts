import {
    formatYear,
    csvEscape,
    parseDelimited,
    min,
    max,
    last,
    orderBy,
    getDropIndexes,
    Grid,
    rowsFromGrid,
    range,
    difference,
    intersection,
    flatten,
    sum,
    differenceBy,
    uniqBy,
} from "grapher/utils/Util"
import { queryParamsToStr } from "utils/client/url"
import { CoreColumn, ColumnTypeMap } from "./CoreTableColumns"
import {
    ColumnSlug,
    CoreColumnStore,
    ColumnTypeNames,
    CoreColumnDef,
    CoreRow,
    CoreTableInputOption,
    PrimitiveType,
    SortOrder,
    Time,
    TransformType,
    ValueRange,
    CoreQuery,
} from "./CoreTableConstants"
import {
    AlignedTextTableOptions,
    toAlignedTextTable,
    toDelimited,
    toMarkdownTable,
} from "./CoreTablePrinters"
import {
    makeAutoTypeFn,
    columnStoreToRows,
    guessColumnDefFromSlugAndRow,
    imemo,
    makeKeyFn,
    makeRowFromColumnStore,
    standardizeSlugs,
} from "./CoreTableUtils"
import { InvalidCellTypes } from "./InvalidCells"
import { OwidTableSlugs } from "./OwidTableConstants"

const TransformsRequiringCompute = new Set([
    TransformType.Load,
    TransformType.AppendRows,
    TransformType.AppendColumns,
    TransformType.UpdateRows,
])

interface AdvancedOptions {
    tableDescription?: string
    transformCategory?: TransformType
    parent?: CoreTable
    rowConversionFunction?: (row: any) => CoreRow
}

// The complex generic with default here just enables you to optionally specify a more
// narrow interface for the input rows. This is helpful for OwidTable.
export class CoreTable<
    ROW_TYPE extends CoreRow = CoreRow,
    COL_DEF_TYPE extends CoreColumnDef = CoreColumnDef
> {
    private _columns: Map<ColumnSlug, CoreColumn> = new Map()
    protected parent?: this
    private tableDescription: string
    private transformCategory: TransformType
    private timeToLoad = 0
    private initTime = Date.now()

    private inputData: CoreTableInputOption
    private advancedOptions: AdvancedOptions

    private inputColumnDefs: COL_DEF_TYPE[]
    constructor(
        rowsOrColumnsOrDsv: CoreTableInputOption = [],
        inputColumnDefs: COL_DEF_TYPE[] = [],
        advancedOptions: AdvancedOptions = {}
    ) {
        const start = Date.now() // Perf aid
        const {
            parent,
            tableDescription = "",
            transformCategory = TransformType.Load,
        } = advancedOptions

        this.tableDescription = tableDescription
        this.transformCategory = transformCategory
        this.parent = parent as this
        this.inputColumnDefs = inputColumnDefs
        this.inputColumnDefs.forEach((def) => this.setColumn(def))
        this.advancedOptions = advancedOptions
        this.inputData = rowsOrColumnsOrDsv

        const autodetectColumns = !parent

        // If this has a parent table, than we expect all defs. This makes "deletes" and "renames" fast.
        // If this is the first input table, then we do a simple check to generate any missing column defs.
        if (autodetectColumns) this.autodetectAndAddColumnsFromFirstRow()

        this.timeToLoad = Date.now() - start // Perf aid
    }

    getValuesFor(columnSlug: ColumnSlug) {
        return this.columnStore[columnSlug]
    }

    @imemo private get rowsFromColumns() {
        const { columnStore } = this
        return range(
            0,
            Object.values(columnStore)[0]?.length ?? 0
        ).map((index) =>
            makeRowFromColumnStore(index, columnStore)
        ) as ROW_TYPE[]
    }

    private get blankColumnStore() {
        const columnsObject: CoreColumnStore = {}
        this.columnSlugs.forEach((slug) => {
            columnsObject[slug] = []
        })
        return columnsObject
    }

    @imemo private get columnStore() {
        return this.slugsToBuild.length || this.isInputFromRowsOrDelimited
            ? Object.assign(
                  this.blankColumnStore,
                  this.inputRowsToColumns,
                  this.inputRowsToParsedColumns,
                  this.inputRowsToComputedColumns
              )
            : this.inputAsColumnStore
    }

    @imemo private get delimitedAsRows() {
        const { inputData, advancedOptions } = this
        const parsed = parseDelimited(
            inputData as string,
            undefined,
            advancedOptions.rowConversionFunction ?? makeAutoTypeFn()
        ) as any
        // dsv_parse adds a columns prop to the result we don't want since we handle our own column defs.
        // https://github.com/d3/d3-dsv#dsv_parse
        delete parsed.columns

        const renamedRows = standardizeSlugs(parsed) // todo: pass renamed defs back in.
        return renamedRows ? renamedRows.rows : parsed
    }

    @imemo private get inputAsRows() {
        const { inputData, isFromDelimited } = this
        return (isFromDelimited
            ? this.delimitedAsRows
            : inputData) as ROW_TYPE[]
    }

    private get inputRowsToColumns() {
        const columnsObject: CoreColumnStore = {}
        const { inputAsRows, firstInputRow } = this
        if (!firstInputRow) return columnsObject
        Object.keys(firstInputRow).forEach((slug) => {
            columnsObject[slug] = inputAsRows.map((row) => row[slug])
        })
        return columnsObject
    }

    private get inputRowsToComputedColumns() {
        const columnsObject: CoreColumnStore = {}
        this.colsToCompute.forEach((def) => {
            columnsObject[def.slug] =
                def.values ??
                this.inputAsRows.map((row, index) => def.fn!(row, index))
        })

        return columnsObject
    }

    private get inputRowsToParsedColumns() {
        const columnsObject: CoreColumnStore = {}
        this.columnsToParse.forEach((col) => {
            const { slug } = col
            columnsObject[slug] = this.inputAsRows
                .map((row) => row[slug])
                .map((val) => col.parse(val))
        })
        return columnsObject
    }

    private get colsToCompute() {
        // We never need to compute on certain transforms
        return TransformsRequiringCompute.has(this.transformCategory)
            ? this.newProvidedColumnDefsToCompute
            : []
    }

    @imemo private get newProvidedColumnDefsToCompute() {
        const cols = this.parent
            ? difference(this.inputColumnDefs, this.parent.defs)
            : this.inputColumnDefs
        return cols.filter((def) => def.fn || def.values)
    }

    private get slugsToBuild() {
        return [
            ...this.colsToCompute.map((col) => col.slug),
            ...this.columnsToParse.map((col) => col.slug),
        ]
    }

    private get firstInputRow() {
        return this.inputAsRows[0]
    }

    private get columnsToParse() {
        if (this.isFromDelimited || this.isInputFromColumns) return []

        const firstInputRow = this.firstInputRow
        if (!firstInputRow) return []
        const cols = this.columnsAsArray
        // The default behavior is to assume some missing or bad data in user data, so we always parse the full input the first time we load
        // user data, with the exception of computed columns.
        // Todo: measure the perf hit and add a parameter to opt out of this this if you know the data is complete?
        if (this.isRoot)
            return differenceBy(
                cols,
                this.newProvidedColumnDefsToCompute,
                (item) => item.slug
            )

        return cols.filter((col) => col.needsParsing(firstInputRow[col.slug]))
    }

    @imemo private get numColsToCompute() {
        return this.colsToCompute.length
    }

    private get inputAsColumnStore() {
        return this.inputData as CoreColumnStore
    }

    @imemo private get isFromDelimited() {
        return typeof this.inputData === "string"
    }

    toOneDimensionalArray() {
        return flatten(this.toMatrix().slice(1))
    }

    private setColumn(def: COL_DEF_TYPE) {
        const { type, slug } = def
        const ColumnType = (type && ColumnTypeMap[type]) ?? ColumnTypeMap.String
        this._columns.set(slug, new ColumnType(this, def))
    }

    protected transform(
        rows: ROW_TYPE[],
        defs: COL_DEF_TYPE[],
        description: string,
        transformType: TransformType
    ): this {
        // The combo of the "this" return type and then casting this to any allows subclasses to create transforms of the
        // same type. The "any" typing is very brief (the returned type will have the same type as the instance being transformed).
        return new (this.constructor as any)(rows, defs, {
            parent: this,
            tableDescription: description,
            transformCategory: transformType,
        })
    }

    private autodetectAndAddColumnsFromFirstRowForColumnStore() {
        const columnStore = this.inputAsColumnStore
        Object.keys(columnStore)
            .filter((slug) => !this.has(slug))
            .forEach((slug) => {
                this.setColumn(
                    guessColumnDefFromSlugAndRow(
                        slug,
                        columnStore[slug].find(
                            (val) => val !== undefined && val !== null
                        )
                    ) as COL_DEF_TYPE
                )
            })
    }

    private autodetectAndAddColumnsFromFirstRow() {
        if (!this.isInputFromRowsOrDelimited)
            return this.autodetectAndAddColumnsFromFirstRowForColumnStore()
        const rows = this.inputAsRows
        if (!rows[0]) return

        Object.keys(rows[0])
            .filter((slug) => !this.has(slug))
            .forEach((slug) => {
                const firstRowWithValue = rows.find(
                    (row) => row[slug] !== undefined && row[slug] !== null
                )
                const firstValue = firstRowWithValue
                    ? firstRowWithValue[slug]
                    : undefined
                this.setColumn(
                    guessColumnDefFromSlugAndRow(
                        slug,
                        firstValue
                    ) as COL_DEF_TYPE
                )
            })
    }

    // Time between when the parent table finished loading and this table started constructing.
    // A large time may just be due to a transform only happening after a user action, or it
    // could be do to other sync code executing between transforms.
    private get betweenTime(): number {
        return this.parent
            ? this.initTime - (this.parent.initTime + this.parent.timeToLoad)
            : 0
    }

    @imemo get rows() {
        return this.isInputFromColumns || this.slugsToBuild.length
            ? this.rowsFromColumns
            : this.inputAsRows
    }

    getTimesAtIndices(indices: number[]) {
        return this.getValuesAtIndices(this.timeColumn!.slug, indices) as Time[]
    }

    getValuesAtIndices(columnSlug: ColumnSlug, indices: number[]) {
        const values = this.get(columnSlug)!.allValues
        return indices.map((index) => values[index])
    }

    @imemo get firstRow() {
        return this.rows[0]
    }

    @imemo get lastRow() {
        return last(this.rows)
    }

    @imemo get numRows() {
        return this.rows.length
    }

    @imemo get numColumns() {
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
    @imemo get timeColumn() {
        // For now, return a day column first if present. But see note above about removing this method.
        const col =
            this.columnsAsArray.find(
                (col) => col instanceof ColumnTypeMap.Date
            ) ||
            this.columnsAsArray.find((col) => col instanceof ColumnTypeMap.Year)
        return col
            ? col
            : this.get(OwidTableSlugs.time) ??
                  this.get(OwidTableSlugs.day) ??
                  this.get(OwidTableSlugs.year)
    }

    // Todo: remove this. Generally this should not be called until the data is loaded. Even then, all calls should probably be made
    // on the column itself, and not tied tightly to the idea of a time column.
    @imemo get timeColumnFormatFunction() {
        return this.timeColumn ? this.timeColumn.formatValue : formatYear
    }

    formatTime(value: any) {
        return this.timeColumnFormatFunction(value)
    }

    @imemo private get columnsWithParseErrors() {
        return this.columnsAsArray.filter((col) => col.numInvalidCells)
    }

    @imemo get numColumnsWithInvalidCells() {
        return this.columnsWithParseErrors.length
    }

    @imemo get numInvalidCells() {
        return sum(this.columnsAsArray.map((col) => col.numInvalidCells))
    }

    @imemo get numValidCells() {
        return sum(this.columnsAsArray.map((col) => col.numValues))
    }

    get rootTable(): this {
        return this.parent ? this.parent.rootTable : this
    }

    /**
     * Returns a string map (aka index) where the keys are the combined string values of columnSlug[], and the values
     * are the values are the rows that match.
     *
     * {country: "USA", population: 100}
     *
     * So `table.rowIndex(["country", "population"]).get("USA 100")` would return [{country: "USA", population: 100}].
     *
     */
    rowIndex(columnSlugs: ColumnSlug[]) {
        const index = new Map<string, ROW_TYPE[]>()
        // keyFn generates a key for each row. Does not have to be unique.
        // todo: be smarter for string keys
        const keyFn = makeKeyFn(columnSlugs)
        this.rows.forEach((row) => {
            const key = keyFn(row)
            if (!index.has(key)) index.set(key, [])
            index.get(key)!.push(row)
        })
        return { index, keyFn }
    }

    // Same as above, but the index is typed and it only supports ony column.
    protected rowTypedIndex<T>(columnSlug: ColumnSlug) {
        const map = new Map<T, ROW_TYPE[]>()
        this.rows.forEach((row) => {
            const value = row[columnSlug]
            if (!map.has(value)) map.set(value, [])
            map.get(value)!.push(row)
        })
        return map
    }

    /**
     * Returns a map (aka index) where the keys are the values of the indexColumnSlug, and the values
     * are the values of the valueColumnSlug.
     *
     * {country: "USA", population: 100}
     *
     * So `table.valueIndex("country", "population").get("USA")` would return 100.
     *
     */
    protected valueIndex(
        indexColumnSlug: ColumnSlug,
        valueColumnSlug: ColumnSlug
    ) {
        const indexCol = this.get(indexColumnSlug)
        const valueCol = this.get(valueColumnSlug)

        if (!indexCol || !valueCol) return new Map()

        const indexValues = indexCol.allValues
        const valueValues = valueCol.allValues
        const indices = intersection(
            indexCol.validRowIndices,
            valueCol.validRowIndices
        )
        const map = new Map<PrimitiveType, PrimitiveType>()
        indices.forEach((index) => {
            map.set(indexValues[index], valueValues[index])
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

    @imemo get rowsAsSet() {
        return new Set(this.rows)
    }

    @imemo get opposite() {
        if (this.isRoot) return this
        const { rowsAsSet } = this
        return this.transform(
            this.parent!.rows.filter((row) => !rowsAsSet.has(row)),
            this.defs,
            `Inversing previous filter`,
            TransformType.InverseFilterRows
        )
    }

    @imemo get oppositeColumns() {
        if (this.isRoot) return this
        const columnsToDrop = new Set(this.columnSlugs)
        const defs = this.parent!.columnsAsArray.filter(
            (col) => !columnsToDrop.has(col.slug)
        ).map((col) => col.def) as COL_DEF_TYPE[]
        return this.transform(
            this.rows,
            defs,
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

        return this.dropColumns(
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
    ) {
        return this.transform(
            this.rows.filter(predicate),
            this.defs,
            opName,
            TransformType.FilterRows
        )
    }

    sortBy(slugs: ColumnSlug[], orders?: SortOrder[]) {
        return this.transform(
            orderBy(this.rows, slugs, orders),
            this.defs,
            `Sort by ${slugs.join(",")} ${orders?.join(",")}`,
            TransformType.SortRows
        )
    }

    sortColumns(slugs: ColumnSlug[]) {
        const first = this.getColumns(slugs)
        const rest = this.columnsAsArray.filter((col) => !first.includes(col))
        return this.transform(
            this.rows,
            [...first, ...rest].map((col) => col.def as COL_DEF_TYPE),
            `Sorted columns`,
            TransformType.SortColumns
        )
    }

    reverse() {
        return this.transform(
            this.rows.slice(0).reverse(),
            this.defs,
            `Reversed row order`,
            TransformType.SortRows
        )
    }

    @imemo get defs() {
        return this.columnsAsArray.map((col) => col.def) as COL_DEF_TYPE[]
    }

    @imemo get columnNames() {
        return this.columnsAsArray.map((col) => col.name)
    }

    @imemo get columnTypes() {
        return this.columnsAsArray.map((col) => col.def.type)
    }

    @imemo get columnJsTypes() {
        return this.columnsAsArray.map((col) => col.jsType)
    }

    @imemo get columnSlugs() {
        return Array.from(this._columns.keys())
    }

    @imemo get numericColumnSlugs() {
        return this.columnsAsArray
            .filter((col) => col instanceof ColumnTypeMap.Numeric)
            .map((col) => col.slug)
    }

    @imemo get columnsAsArray() {
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

    private get isRoot() {
        return !this.parent
    }

    dump(rowLimit = 30) {
        this.dumpPipeline()
        this.dumpColumns()
        this.dumpRows(rowLimit)
    }

    dumpPipeline() {
        // eslint-disable-next-line no-console
        console.table(this.ancestors.map((tb) => tb.explanation))
    }

    dumpColumns() {
        // eslint-disable-next-line no-console
        console.table(this.explainColumns)
    }

    dumpRows(rowLimit = 30) {
        // eslint-disable-next-line no-console
        console.table(this.rows.slice(0, rowLimit), this.columnSlugs)
    }

    dumpInputTable() {
        // eslint-disable-next-line no-console
        console.table(this.inputAsTable)
    }

    @imemo private get isInputFromRowsOrDelimited() {
        return Array.isArray(this.inputData) || this.isFromDelimited
    }

    @imemo private get isInputFromColumns() {
        return !this.isInputFromRowsOrDelimited
    }

    @imemo private get inputAsTable() {
        return this.isInputFromRowsOrDelimited
            ? this.inputAsRows
            : columnStoreToRows(this.inputAsColumnStore)
    }

    @imemo private get explainColumns() {
        return this.columnsAsArray.map((col) => {
            const {
                slug,
                jsType,
                name,
                numValues,
                numInvalidCells,
                displayName,
                def,
            } = col
            return {
                slug,
                type: def.type,
                jsType,
                name,
                numValues,
                numInvalidCells,
                displayName,
                color: def.color,
            }
        })
    }

    get ancestors(): this[] {
        return this.parent ? [...this.parent.ancestors, this] : [this]
    }

    @imemo private get numColsToParse() {
        return this.columnsToParse.length
    }

    private static guids = 0
    private guid = ++CoreTable.guids

    private get explanation() {
        // todo: is there a better way to do this in JS?
        const {
            tableDescription,
            transformCategory,
            guid,
            numColumns,
            numRows,
            timeToLoad,
            betweenTime,
            numColsToParse,
            numColsToCompute,
            numValidCells,
            numInvalidCells,
            numColumnsWithInvalidCells,
        } = this
        return {
            tableDescription: tableDescription.substr(0, 30),
            transformCategory,
            guid,
            numColumns,
            numRows,
            timeToLoad,
            betweenTime,
            numColsToParse,
            numColsToCompute,
            numValidCells,
            numInvalidCells,
            numColumnsWithInvalidCells,
        }
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
    get constantColumns() {
        return this.columnsAsArray.filter((col) => col.isConstant)
    }

    rowsAt(indices: number[]) {
        const rows = this.rows
        return indices.map((index) => rows[index])
    }

    findRows(query: CoreQuery) {
        const slugs = Object.keys(query)
        if (!slugs.length) return this.rows
        const arrs = this.getColumns(slugs).map((col) =>
            col.indicesWhere(query[col.slug])
        )
        return this.rowsAt(intersection(...arrs))
    }

    indexOf(row: ROW_TYPE) {
        return this.rows.indexOf(row)
    }

    where(query: CoreQuery) {
        const rows = this.findRows(query)
        return this.transform(
            rows,
            this.defs,
            `Selecting ${rows.length} rows where ${queryParamsToStr(
                query as any
            ).substr(1)}`,
            TransformType.FilterRows
        )
    }

    appendRows(rows: ROW_TYPE[], opDescription: string) {
        return this.transform(
            [...this.rows, ...rows],
            this.defs,
            opDescription,
            TransformType.AppendRows
        )
    }

    limit(howMany: number, offset: number = 0) {
        const rows = this.rows.slice(offset, howMany + offset)
        return this.transform(
            rows,
            this.defs,
            `Kept ${rows.length} rows starting at ${offset}`,
            TransformType.FilterRows
        )
    }

    updateDefs(fn: (def: COL_DEF_TYPE) => COL_DEF_TYPE) {
        return this.transform(
            this.rows,
            this.defs.map(fn),
            `Updated column defs`,
            TransformType.UpdateColumnDefs
        )
    }

    limitColumns(howMany: number, offset: number = 0) {
        const slugs = this.columnSlugs.slice(offset, howMany + offset)
        return this.dropColumns(
            slugs,
            `Kept ${howMany} columns and dropped '${slugs}'`
        )
    }

    dropConstantColumns() {
        const slugs = this.constantColumns.map((col) => col.slug)
        return this.dropColumns(slugs, `Dropped constant columns '${slugs}'`)
    }

    select(slugs: ColumnSlug[]) {
        const columnsToKeep = new Set(slugs)
        const defs = this.columnsAsArray
            .filter((col) => columnsToKeep.has(col.slug))
            .map((col) => col.def) as COL_DEF_TYPE[]
        return this.transform(
            this.rows,
            defs,
            `Kept columns '${slugs}'`,
            TransformType.FilterColumns
        )
    }

    dropColumns(slugs: ColumnSlug[], message?: string) {
        const columnsToDrop = new Set(slugs)
        const defs = this.columnsAsArray
            .filter((col) => !columnsToDrop.has(col.slug))
            .map((col) => col.def) as COL_DEF_TYPE[]
        return this.transform(
            this.rows,
            defs,
            message ?? `Dropped columns '${slugs}'`,
            TransformType.FilterColumns
        )
    }

    @imemo get duplicateRowIndices() {
        const keyFn = makeKeyFn(this.columnSlugs)
        const dupeSet = new Set()
        const dupeIndices: number[] = []
        this.rows.forEach((row, rowIndex) => {
            const key = keyFn(row)
            if (dupeSet.has(key)) dupeIndices.push(rowIndex)
            else dupeSet.add(key)
        })
        return dupeIndices
    }

    dropDuplicateRows() {
        return this.dropRowsAt(this.duplicateRowIndices)
    }

    // Todo: improve typings. After renaming a column the row interface should change. Applies to some other methods as well.
    renameColumns(columnRenameMap: { [columnSlug: string]: ColumnSlug }) {
        const oldSlugs = Object.keys(columnRenameMap)
        const newSlugs = Object.values(columnRenameMap)

        const message =
            `Renamed ` +
            oldSlugs
                .map((name, index) => `'${name}' to '${newSlugs[index]}'`)
                .join(" and ")

        return this.transform(
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
            message,
            TransformType.RenameColumns
        )
    }

    dropRowsAt(indices: number[]) {
        const set = new Set(indices)
        return this.filter(
            (row, index) => !set.has(index),
            `Dropping ${indices.length} rows`
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
                    newRow[slug] = InvalidCellTypes.InvalidOnALogScale
                    replacedCellCount++
                }
            })
            return newRow
        })
        return this.transform(
            newRows,
            this.defs,
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
        replacementGenerator: () => any = () =>
            InvalidCellTypes.DroppedForTesting
    ) {
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
        }) as COL_DEF_TYPE[]
        return this.transform(
            this.rows,
            defs,
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

    filterNegativesForLogScale(columnSlug: ColumnSlug) {
        return this.filter(
            (row) => row[columnSlug] > 0,
            `Remove rows if ${columnSlug} is <= 0 for log scale`
        )
    }

    appendColumns(defs: COL_DEF_TYPE[]) {
        return this.transform(
            this.rows,
            this.defs.concat(defs),
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
        return this.transform(
            rows,
            this.defs,
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
        }) as COL_DEF_TYPE[]
        const newRowValues = this.columnsAsArray
            .filter((col) => col.slug !== by)
            .map((col) => [col.slug, ...col.allValues])
        return this.transform(
            rowsFromGrid([newColumnSlugs, ...newRowValues]),
            newColumnDefs,
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

    private join(
        destinationTable: CoreTable,
        sourceTable: CoreTable,
        by?: ColumnSlug[]
    ) {
        by =
            by ??
            intersection(sourceTable.columnSlugs, destinationTable.columnSlugs)
        const columnSlugsToAdd = difference(
            sourceTable.columnSlugs,
            destinationTable.columnSlugs
        )
        const defsToAdd = sourceTable
            .getColumns(columnSlugsToAdd)
            .map((col) => {
                const def = { ...col.def }
                def.values = []
                return def
            }) as COL_DEF_TYPE[]

        const { index, keyFn } = sourceTable.rowIndex(by)

        destinationTable.rows.forEach((row) => {
            const matchingRightRow = index.get(keyFn(row))
            defsToAdd.forEach((def) => {
                if (matchingRightRow)
                    def.values?.push(matchingRightRow[0][def.slug])
                // todo: use first or last match?
                else
                    def.values?.push(
                        InvalidCellTypes.NoMatchingValueAfterJoin as any
                    )
            })
        })
        return defsToAdd
    }

    concat(table: CoreTable) {
        const defs = [...this.defs, ...table.defs] as COL_DEF_TYPE[]
        return this.transform(
            this.rows.concat(table.rows as ROW_TYPE[]),
            uniqBy(defs, (def) => def.slug),
            `Combined table`,
            TransformType.Concat
        )
    }

    leftJoin(rightTable: CoreTable, by?: ColumnSlug[]): this {
        return this.appendColumns(this.join(this, rightTable, by))
    }

    rightJoin(rightTable: CoreTable, by?: ColumnSlug[]): this {
        return rightTable.leftJoin(this, by) as any // todo: change parent?
    }

    innerJoin(rightTable: CoreTable, by?: ColumnSlug[]) {
        const defs = this.join(this, rightTable, by)
        const newValues = defs.map((def) => def.values)
        const rowsToDrop: number[] = []
        newValues.forEach((col) => {
            col?.forEach((value, index) => {
                if (
                    (value as any) === InvalidCellTypes.NoMatchingValueAfterJoin
                )
                    rowsToDrop.push(index)
            })
        })
        return this.appendColumns(defs).dropRowsAt(rowsToDrop)
    }

    fullJoin(rightTable: CoreTable, by?: ColumnSlug[]): this {
        return this.leftJoin(rightTable, by)
            .concat(rightTable.leftJoin(this, by))
            .dropDuplicateRows()
    }
}
