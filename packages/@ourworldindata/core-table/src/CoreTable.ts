import * as _ from "lodash-es"
import {
    csvEscape,
    intersection,
    isPresent,
    ColumnSlug,
    PrimitiveType,
    imemo,
} from "@ourworldindata/utils"
import {
    CoreColumn,
    ColumnTypeMap,
    MissingColumn,
    TimeColumn,
} from "./CoreTableColumns.js"
import {
    CoreColumnStore,
    CoreRow,
    CoreTableInputOption,
    Time,
    TransformType,
    ValueRange,
    CoreQuery,
    CoreValueType,
    InputType,
    CoreMatrix,
    TableSlug,
    ColumnTypeNames,
    CoreColumnDef,
    JsTypes,
    OwidTableSlugs,
    OwidColumnDef,
} from "@ourworldindata/types"
import {
    makeAutoTypeFn,
    columnStoreToRows,
    makeKeyFn,
    makeRowFromColumnStore,
    standardizeSlugs,
    concatColumnStores,
    rowsToColumnStore,
    autodetectColumnDefs,
    renameColumnStore,
    replaceRandomCellsInColumnStore,
    parseDelimited,
    rowsFromMatrix,
    sortColumnStore,
    emptyColumnsInFirstRowInDelimited,
    truncate,
} from "./CoreTableUtils.js"
import {
    ErrorValueTypes,
    isNotErrorValue,
    DroppedForTesting,
} from "./ErrorValues.js"
import { applyTransforms, extractTransformNameAndParams } from "./Transforms.js"

interface AdvancedOptions {
    tableDescription?: string
    transformCategory?: TransformType
    parent?: CoreTable
    filterMask?: FilterMask
    tableSlug?: TableSlug
    forceReuseColumnStore?: boolean
}

// The complex generic with default here just enables you to optionally specify a more
// narrow interface for the input rows. This is helpful for OwidTable.
export class CoreTable<
    ROW_TYPE extends CoreRow = CoreRow,
    COL_DEF_TYPE extends CoreColumnDef = CoreColumnDef,
> {
    private _columns: Map<ColumnSlug, CoreColumn> = new Map()
    protected parent?: this
    tableDescription: string
    private timeToLoad = 0
    private initTime = Date.now()

    private originalInput: CoreTableInputOption
    private advancedOptions: AdvancedOptions

    private inputColumnDefs: COL_DEF_TYPE[]
    constructor(
        input: CoreTableInputOption = [],
        inputColumnDefs: COL_DEF_TYPE[] | string = [],
        advancedOptions: AdvancedOptions = {}
    ) {
        const start = Date.now() // Perf aid
        const { parent, tableDescription = "" } = advancedOptions

        this.originalInput = input
        this.tableDescription = tableDescription
        this.parent = parent as this
        this.inputColumnDefs =
            typeof inputColumnDefs === "string"
                ? columnDefinitionsFromInput<COL_DEF_TYPE>(inputColumnDefs)
                : inputColumnDefs

        // Column definitions with a "duplicate" transform are merged with the column definition of the specified source column
        this.inputColumnDefs = this.inputColumnDefs.map((def) => {
            if (!def.transform) return def
            const transform = extractTransformNameAndParams(def.transform)
            if (transform?.transformName !== "duplicate") return def

            const sourceSlug = transform.params[0]
            const sourceDef = this.inputColumnDefs.find(
                (def) => def.slug === sourceSlug
            )
            return { ...sourceDef, ...def }
        })

        // If any values were passed in, copy those to column store now and then remove them from column definitions.
        // todo: remove values property entirely? may be an anti-pattern.
        this.inputColumnDefs = this.inputColumnDefs.map((def) => {
            if (!def.values) return def
            this.valuesFromColumnDefs[def.slug] = def.values
            const copy = {
                ...def,
            }
            delete copy.values
            return copy
        })

        this.inputColumnDefs.forEach((def) => this.setColumn(def))

        this.advancedOptions = advancedOptions

        // If this has a parent table, than we expect all defs. This makes "deletes" and "renames" fast.
        // If this is the first input table, then we do a simple check to generate any missing column defs.
        if (!parent)
            autodetectColumnDefs(this.inputColumnStore, this._columns).forEach(
                (def) => this.setColumn(def as COL_DEF_TYPE)
            )

        this.timeToLoad = Date.now() - start // Perf aid
    }

    private valuesFromColumnDefs: CoreColumnStore = {}

    // A method currently used just in debugging but may be useful in the author backend.
    // If your charts look funny, a good thing to check is if the autodetected columns are wrong.
    get autodetectedColumnDefs(): CoreTable {
        const providedSlugs = new Set(
            this.inputColumnDefs.map((def) => def.slug)
        )
        return new CoreTable(
            this.defs.filter((def) => !providedSlugs.has(def.slug))
        )
    }

    @imemo get transformCategory(): TransformType {
        const { advancedOptions, inputType } = this
        if (advancedOptions.transformCategory)
            return advancedOptions.transformCategory

        if (inputType === InputType.Delimited)
            return TransformType.LoadFromDelimited
        if (inputType === InputType.Matrix) return TransformType.LoadFromMatrix
        if (inputType === InputType.RowStore)
            return TransformType.LoadFromRowStore
        return TransformType.LoadFromColumnStore
    }

    // If the input is a column store, returns that. If it is DSV, parses that and turns it into a column store.
    // If it is a Rows[], turns it into a column store.
    @imemo private get inputColumnStore(): CoreColumnStore {
        const { originalInput, inputType } = this

        if (inputType === InputType.Delimited)
            return this.delimitedAsColumnStore
        else if (inputType === InputType.Matrix)
            return rowsToColumnStore(
                rowsFromMatrix(originalInput as CoreMatrix)
            )
        else if (inputType === InputType.RowStore)
            return rowsToColumnStore(originalInput as CoreRow[])
        return originalInput as CoreColumnStore
    }

    // This can, in theory, be used to detect whether we can reuse the input column store, which can save us time parsing.
    // However, I'm not entirely sure whether the conditions included here are complete, so we don't currently use it.
    // We do use `advancedOptions.forceReuseColumnStore`, however.
    @imemo get canReuseInputColumnStore(): boolean {
        const { inputColumnDefs, valuesFromColumnDefs, columnSlugs } = this

        const storeHasAllColumns = columnSlugs.every(
            (slug) => slug in this.inputColumnStore
        )

        const columnsFromTransforms = inputColumnDefs.filter(
            (def) => def.transform && !def.transformHasRun
        )

        return (
            !this.colsToParse.length &&
            storeHasAllColumns &&
            !Object.keys(valuesFromColumnDefs).length &&
            !columnsFromTransforms.length
        )
    }

    @imemo get columnStore(): CoreColumnStore {
        const { inputColumnStore, advancedOptions } = this

        if (advancedOptions.forceReuseColumnStore) {
            if (advancedOptions.filterMask)
                return advancedOptions.filterMask.apply(inputColumnStore)
            else return inputColumnStore
        }

        const {
            valuesFromColumnDefs,
            inputColumnsToParsedColumnStore,
            inputColumnDefs,
        } = this

        // Set blank columns
        let columnStore = Object.assign(
            {},
            this.blankColumnStore,
            inputColumnStore,
            valuesFromColumnDefs
        )

        // Overwrite any non-parsed columns with parsed values
        if (Object.keys(inputColumnsToParsedColumnStore).length)
            columnStore = Object.assign(
                columnStore,
                inputColumnsToParsedColumnStore
            )

        // If we ever pass Mobx observable arrays, we need to convert them to regular arrays.
        // Otherwise, operations like `.concat()` will break in unexpected ways.
        // See https://github.com/mobxjs/mobx/blob/mobx4and5/docs/best/pitfalls.md
        // Also, see https://github.com/owid/owid-grapher/issues/2948 for an issue caused by this problem.
        type CoreValueArrayThatMayBeMobxProxy = CoreValueType[] & {
            toJS?: () => CoreValueType[]
        }

        for (const [slug, values] of Object.entries(columnStore)) {
            const valuesThatMayBeMobxProxy =
                values as CoreValueArrayThatMayBeMobxProxy
            if (typeof valuesThatMayBeMobxProxy.toJS === "function") {
                columnStore[slug] = valuesThatMayBeMobxProxy.toJS()
            }
        }

        const columnsFromTransforms = inputColumnDefs.filter(
            (def) => def.transform && !def.transformHasRun
        ) // todo: sort by graph dependency order
        if (columnsFromTransforms.length) {
            columnStore = applyTransforms(columnStore, columnsFromTransforms)
        }

        return advancedOptions.filterMask
            ? advancedOptions.filterMask.apply(columnStore)
            : columnStore
    }

    private get blankColumnStore(): CoreColumnStore {
        const columnsObject: CoreColumnStore = {}
        this.columnSlugs.forEach((slug) => {
            columnsObject[slug] = []
        })
        return columnsObject
    }

    @imemo private get delimitedAsColumnStore(): CoreColumnStore {
        const { originalInput, _numericColumnSlugs } = this
        const parsed = parseDelimited(
            originalInput as string,
            undefined,
            makeAutoTypeFn(_numericColumnSlugs)
        ) as any
        // Remove the columns object from the parsed object
        delete parsed.columns

        const renamedRows = standardizeSlugs(parsed) // todo: pass renamed defs back in.
        return rowsToColumnStore(renamedRows ? renamedRows.rows : parsed)
    }

    get tableSlug(): string | undefined {
        return this.advancedOptions.tableSlug
    }

    private get inputColumnsToParsedColumnStore(): CoreColumnStore {
        const { inputColumnStore, colsToParse } = this
        const columnsObject: CoreColumnStore = {}
        if (!colsToParse.length) return columnsObject
        const missingCols: CoreColumn[] = []
        let len = 0
        colsToParse.forEach((col) => {
            const { slug } = col
            const unparsedVals = inputColumnStore[slug]
            if (!unparsedVals) {
                missingCols.push(col)
                return
            }
            columnsObject[slug] = unparsedVals.map((val) => col.parse(val))
            len = columnsObject[slug].length
        })

        // If column defs were provided but there were no values provided for those columns, create blank columns the same size
        // as the filled columns.
        missingCols.forEach(
            (col) =>
                (columnsObject[col.slug] = _.range(0, len).map(() =>
                    col.parse(undefined)
                ))
        )
        return columnsObject
    }

    private get colsToParse(): CoreColumn[] {
        const { inputType, columnsAsArray, inputColumnStore } = this
        const columnsToMaybeParse = columnsAsArray.filter(
            (col) => !col.def.skipParsing
        )
        const firstInputRow = makeRowFromColumnStore(0, inputColumnStore)
        if (inputType === InputType.Delimited) {
            const missingTypes = new Set(
                this.getColumns(
                    emptyColumnsInFirstRowInDelimited(
                        this.originalInput as string
                    )
                )
            ) // Our autotyping is poor if the first value in a column is empty
            return columnsToMaybeParse.filter(
                (col) =>
                    col.needsParsing(firstInputRow[col.slug]) ||
                    missingTypes.has(col)
            )
        }

        if (this.parent || !firstInputRow) return []

        // The default behavior is to assume some missing or bad data in user data, so we always parse the full input the first time we load
        // user data, with the exception of columns that have values passed directly.
        // Todo: measure the perf hit and add a parameter to opt out of this this if you know the data is complete?
        const alreadyTypedSlugs = new Set(
            Object.keys(this.valuesFromColumnDefs)
        )
        if (this.isRoot) {
            return columnsToMaybeParse.filter(
                (col) => !alreadyTypedSlugs.has(col.slug)
            )
        }

        return columnsToMaybeParse.filter(
            (col) =>
                !alreadyTypedSlugs.has(col.slug) ||
                col.needsParsing(firstInputRow[col.slug])
        )
    }

    private setColumn(def: COL_DEF_TYPE): void {
        const { type, slug } = def
        const ColumnType = (type && ColumnTypeMap[type]) || ColumnTypeMap.String
        this._columns.set(slug, new ColumnType(this, def))
    }

    protected transform(
        rowsOrColumnStore: ROW_TYPE[] | CoreColumnStore | CoreMatrix,
        defs: COL_DEF_TYPE[],
        tableDescription: string,
        transformCategory: TransformType,
        filterMask?: FilterMask
    ): this {
        // The combo of the "this" return type and then casting this to any allows subclasses to create transforms of the
        // same type. The "any" typing is very brief (the returned type will have the same type as the instance being transformed).
        return new (this.constructor as any)(rowsOrColumnStore, defs, {
            parent: this,
            tableDescription,
            transformCategory,
            filterMask,
        } as AdvancedOptions)
    }

    protected noopTransform(tableDescription: string): this {
        return new (this.constructor as any)(this.columnStore, this.defs, {
            parent: this,
            tableDescription,
            transformCategory: TransformType.Noop,
            forceReuseColumnStore: true,
        } as AdvancedOptions)
    }

    // Time between when the parent table finished loading and this table started constructing.
    // A large time may just be due to a transform only happening after a user action, or it
    // could be do to other sync code executing between transforms.
    private get betweenTime(): number {
        return this.parent
            ? this.initTime - (this.parent.initTime + this.parent.timeToLoad)
            : 0
    }

    @imemo get rows(): ROW_TYPE[] {
        return columnStoreToRows(this.columnStore) as ROW_TYPE[]
    }

    @imemo get indices(): number[] {
        return _.range(0, this.numRows)
    }

    *[Symbol.iterator](): Generator<CoreRow, void, unknown> {
        const { columnStore, numRows } = this
        for (let index = 0; index < numRows; index++) {
            yield makeRowFromColumnStore(index, columnStore)
        }
    }

    getTimesAtIndices(indices: number[]): number[] {
        if (!indices.length) return []
        return this.getValuesAtIndices(this.timeColumn!.slug, indices) as Time[]
    }

    getValuesAtIndices(
        columnSlug: ColumnSlug,
        indices: number[]
    ): CoreValueType[] {
        const values = this.get(columnSlug).valuesIncludingErrorValues
        return indices.map((index) => values[index])
    }

    @imemo get firstRow(): ROW_TYPE {
        return makeRowFromColumnStore(0, this.columnStore) as ROW_TYPE
    }

    @imemo get lastRow(): ROW_TYPE {
        return makeRowFromColumnStore(
            this.numRows - 1,
            this.columnStore
        ) as ROW_TYPE
    }

    @imemo get numRows(): number {
        const firstColValues = Object.values(this.columnStore)[0]
        return firstColValues ? firstColValues.length : 0
    }

    @imemo get numColumns(): number {
        return this.columnSlugs.length
    }

    get(columnSlug: ColumnSlug | undefined): CoreColumn {
        if (columnSlug === undefined)
            return new MissingColumn(this, {
                slug: `undefined_slug`,
            })
        return (
            this._columns.get(columnSlug) ??
            new MissingColumn(this, {
                slug: columnSlug,
            })
        )
    }

    has(columnSlug: ColumnSlug | undefined): boolean {
        if (columnSlug === undefined) return false
        return this._columns.has(columnSlug)
    }

    getFirstColumnWithType(
        columnTypeName: ColumnTypeNames
    ): CoreColumn | undefined {
        return this.columnsAsArray.find(
            (col) => col.def.type === columnTypeName
        )
    }

    // todo: move this. time methods should not be in CoreTable, in OwidTable instead (which is really TimeSeriesTable).
    // TODO: remove this. Currently we use this to get the right day/year time formatting. For now a chart is either a "day chart" or a "year chart".
    // But we can have charts with multiple time columns. Ideally each place that needs access to the timeColumn, would get the specific column
    // and not the first time column from the table.
    @imemo get timeColumn(): TimeColumn | MissingColumn {
        // "time" is the canonical time column slug.
        // See LegacyToOwidTable where this column is injected for all Graphers.
        const maybeTimeColumn = this.get(OwidTableSlugs.time)
        if (maybeTimeColumn instanceof ColumnTypeMap.Time)
            return maybeTimeColumn
        // If a valid "time" column doesn't exist, find _some_ time column to use.
        // This is somewhat unreliable and currently only used to infer the time
        // column on explorers.
        return (this.columnsAsArray.find(
            (col) => col instanceof ColumnTypeMap.Day
        ) ??
            this.columnsAsArray.find(
                (col) => col instanceof ColumnTypeMap.Date
            ) ??
            this.columnsAsArray.find(
                (col) => col instanceof ColumnTypeMap.Year
            ) ??
            this.columnsAsArray.find(
                (col) => col instanceof ColumnTypeMap.Quarter
            ) ??
            maybeTimeColumn) as TimeColumn | MissingColumn
    }

    // todo: should be on owidtable
    @imemo get entityNameColumn(): CoreColumn {
        return (
            this.getFirstColumnWithType(ColumnTypeNames.EntityName) ??
            this.get(OwidTableSlugs.entityName)
        )
    }

    // todo: should be on owidtable
    @imemo get entityNameSlug(): string {
        return this.entityNameColumn.slug
    }

    @imemo private get columnsWithParseErrors(): CoreColumn[] {
        return this.columnsAsArray.filter((col) => col.numErrorValues)
    }

    @imemo get numColumnsWithErrorValues(): number {
        return this.columnsWithParseErrors.length
    }

    @imemo get numErrorValues(): number {
        return _.sum(this.columnsAsArray.map((col) => col.numErrorValues))
    }

    @imemo get numValidCells(): number {
        return _.sum(this.columnsAsArray.map((col) => col.numValues))
    }

    @imemo get colStoreIsEqualToParent(): boolean {
        return this.parent
            ? this.columnStore === this.parent.columnStore
            : false
    }

    get rootTable(): this {
        return this.parent ? this.parent.rootTable : this
    }

    /**
     * Returns a string map (aka index) where the keys are the combined string values of columnSlug[], and the values
     * are the indices for the rows that match.
     *
     * {country: "USA", population: 100}
     *
     * So `table.rowIndex(["country", "population"]).get("USA 100")` would return [0].
     *
     */
    rowIndex(columnSlugs: ColumnSlug[]): Map<string, number[]> {
        const index = new Map<string, number[]>()
        const keyFn = makeKeyFn(this.columnStore, columnSlugs)
        for (let i = 0; i < this.numRows; i++) {
            const key = keyFn(i)
            if (index.has(key)) index.get(key)!.push(i)
            else index.set(key, [i])
        }
        return index
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
    ): Map<PrimitiveType, PrimitiveType> {
        const indexCol = this.get(indexColumnSlug)
        const valueCol = this.get(valueColumnSlug)
        const indexValues = indexCol.valuesIncludingErrorValues
        const valueValues = valueCol.valuesIncludingErrorValues
        const valueIndices = new Set(valueCol.validRowIndices)
        const intersection = indexCol.validRowIndices.filter((index) =>
            valueIndices.has(index)
        )

        const map = new Map<PrimitiveType, PrimitiveType>()
        intersection.forEach((index) => {
            map.set(
                indexValues[index] as PrimitiveType,
                valueValues[index] as PrimitiveType
            )
        })
        return map
    }

    grep(searchStringOrRegex: string | RegExp): this {
        return this.rowFilter((row) => {
            const line = Object.values(row).join(" ")
            return typeof searchStringOrRegex === "string"
                ? line.includes(searchStringOrRegex)
                : searchStringOrRegex.test(line)
        }, `Kept rows that matched '${searchStringOrRegex.toString()}'`)
    }

    rowFilter(
        predicate: (row: ROW_TYPE, index: number) => boolean,
        opName: string
    ): this {
        const mask = new FilterMask(this.numRows, this.rows.map(predicate)) // Warning: this will be slow
        if (mask.isNoop()) return this.noopTransform(opName)

        return this.transform(
            this.columnStore,
            this.defs,
            opName,
            TransformType.FilterRows,
            mask
        )
    }

    columnFilter(
        columnSlug: ColumnSlug,
        predicate: (value: CoreValueType, index: number) => boolean,
        opName: string
    ): this {
        const mask = new FilterMask(
            this.numRows,
            this.get(columnSlug).valuesIncludingErrorValues.map(predicate)
        )
        if (mask.isNoop()) return this.noopTransform(opName)

        return this.transform(
            this.columnStore,
            this.defs,
            opName,
            TransformType.FilterRows,
            mask
        )
    }

    sortBy(slugs: ColumnSlug[]): this {
        const description = `Sort by ${slugs.join(",")}`
        const sorted = sortColumnStore(this.columnStore, slugs)

        if (sorted === this.columnStore) return this.noopTransform(description)
        else
            return this.transform(
                sorted,
                this.defs,
                description,
                TransformType.SortRows
            )
    }

    // Assumes table is sorted by columnSlug. Returns an array representing the starting index of each new group.
    protected groupBoundaries(columnSlug: ColumnSlug): number[] {
        const values = this.get(columnSlug).valuesIncludingErrorValues
        const arr: number[] = []
        let last: CoreValueType | undefined = undefined
        for (let i = 0; i < values.length; i++) {
            const val = values[i]
            if (val !== last) {
                arr.push(i)
                last = val
            }
        }
        // Include the end of the last group, which doesn't result in a change in value above.
        if (values && values.length) {
            arr.push(values.length)
        }
        return arr
    }

    @imemo get defs(): COL_DEF_TYPE[] {
        return this.columnsAsArray.map((col) => col.def) as COL_DEF_TYPE[]
    }

    @imemo get columnNames(): string[] {
        return this.columnsAsArray.map((col) => col.name)
    }

    @imemo get columnTypes(): (ColumnTypeNames | undefined)[] {
        return this.columnsAsArray.map((col) => col.def.type)
    }

    @imemo get columnJsTypes(): JsTypes[] {
        return this.columnsAsArray.map((col) => col.jsType)
    }

    @imemo get columnSlugs(): string[] {
        return Array.from(this._columns.keys())
    }

    @imemo get numericColumnSlugs(): string[] {
        return this._numericColumnSlugs
    }

    private get _numericColumnSlugs(): string[] {
        return this._columnsAsArray
            .filter((col) => col instanceof ColumnTypeMap.Numeric)
            .map((col) => col.slug)
    }

    private get _columnsAsArray(): CoreColumn[] {
        return Array.from(this._columns.values())
    }

    @imemo get columnsAsArray(): CoreColumn[] {
        return this._columnsAsArray
    }

    getColumns(slugs: ColumnSlug[]): CoreColumn[] {
        return slugs.map((slug) => this.get(slug))
    }

    // Get the min and max for multiple columns at once
    domainFor(slugs: ColumnSlug[]): ValueRange {
        const cols = this.getColumns(slugs)
        const mins = cols.map((col) => col.minValue)
        const maxes = cols.map((col) => col.maxValue)
        return [_.min(mins), _.max(maxes)]
    }

    private get isRoot(): boolean {
        return !this.parent
    }

    dump(rowLimit = 30): void {
        this.dumpPipeline()
        this.dumpColumns()
        this.dumpRows(rowLimit)
    }

    dumpPipeline(): void {
        // eslint-disable-next-line no-console
        console.table(this.ancestors.map((tb) => tb.explanation))
    }

    dumpColumns(): void {
        // eslint-disable-next-line no-console
        console.table(this.explainColumns)
    }

    rowsFrom(start: number, end: number): any {
        if (start >= this.numRows) return []
        if (end > this.numRows) end = this.numRows
        return _.range(start, end).map((index) =>
            makeRowFromColumnStore(index, this.columnStore)
        )
    }

    dumpRows(rowLimit = 30): void {
        // eslint-disable-next-line no-console
        console.table(this.rowsFrom(0, rowLimit), this.columnSlugs)
    }

    dumpInputTable(): void {
        // eslint-disable-next-line no-console
        console.table(this.inputAsTable)
    }

    @imemo private get inputType(): InputType {
        const { originalInput } = this
        if (typeof originalInput === "string") return InputType.Delimited
        if (Array.isArray(originalInput))
            return Array.isArray(originalInput[0])
                ? InputType.Matrix
                : InputType.RowStore
        return InputType.ColumnStore
    }

    @imemo private get inputColumnStoreToRows(): Record<
        string,
        CoreValueType
    >[] {
        return columnStoreToRows(this.inputColumnStore)
    }

    @imemo private get inputAsTable():
        | Record<string, CoreValueType>[]
        | CoreTableInputOption {
        const { inputType } = this
        return inputType === InputType.ColumnStore
            ? this.inputColumnStoreToRows
            : inputType === InputType.Matrix
              ? rowsFromMatrix(this.originalInput as CoreMatrix)
              : this.originalInput
    }

    @imemo private get explainColumns(): Record<string, unknown>[] {
        return this.columnsAsArray.map((col) => {
            const {
                slug,
                jsType,
                name,
                numValues,
                numErrorValues,
                displayName,
                def,
            } = col
            return {
                slug,
                type: def.type,
                jsType,
                name,
                numValues,
                numErrorValues,
                displayName,
                color: def.color,
            }
        })
    }

    get ancestors(): this[] {
        return this.parent ? [...this.parent.ancestors, this] : [this]
    }

    @imemo private get numColsToParse(): number {
        return this.colsToParse.length
    }

    private static guids = 0
    private guid = ++CoreTable.guids

    private get explanation(): Record<string, unknown> {
        // todo: is there a better way to do this in JS?
        const {
            tableDescription,
            transformCategory,
            guid,
            numColumns,
            numRows,
            betweenTime,
            timeToLoad,
            numColsToParse,
            numValidCells,
            numErrorValues,
            numColumnsWithErrorValues,
            colStoreIsEqualToParent,
        } = this
        return {
            tableDescription: truncate(tableDescription, 40),
            transformCategory,
            guid,
            numColumns,
            numRows,
            betweenTime,
            timeToLoad,
            numColsToParse,
            numValidCells,
            numErrorValues,
            numColumnsWithErrorValues,
            colStoreIsEqualToParent,
        }
    }

    toCsvWithColumnNames(useShortNames: boolean = false): string {
        const delimiter = ","
        const header =
            this.columnsAsArray
                .map((col) =>
                    csvEscape(
                        useShortNames && (col.def as OwidColumnDef).shortName
                            ? (col.def as OwidColumnDef).shortName
                            : col.name
                    )
                )
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

    rowsAt(indices: number[]): ROW_TYPE[] {
        const { columnStore } = this
        return indices.map(
            (index) => makeRowFromColumnStore(index, columnStore) as ROW_TYPE
        )
    }

    findRows(query: CoreQuery): ROW_TYPE[] {
        return this.rowsAt(this.findRowsIndices(query))
    }

    findRowsIndices(query: CoreQuery): any {
        const slugs = Object.keys(query)
        if (!slugs.length) return this.indices
        const arrs = this.getColumns(slugs).map((col) =>
            col.indicesWhere(query[col.slug])
        )
        return intersection(...arrs)
    }

    indexOf(row: ROW_TYPE): any {
        return this.findRowsIndices(row)[0] ?? -1
    }

    where(query: CoreQuery): this {
        const rows = this.findRows(query)
        const queryDescription = Object.entries(query)
            .map(([col, value]) => `${col}=${value}`)
            .join("&")

        return this.transform(
            rows,
            this.defs,
            `Selecting ${rows.length} rows where ${queryDescription}`,
            TransformType.FilterRows
        )
    }

    appendRows(rows: ROW_TYPE[], opDescription: string): this {
        return this.concat(
            [
                new (this.constructor as typeof CoreTable)(rows, this.defs, {
                    parent: this,
                }),
            ],
            opDescription
        )
    }

    updateDefs(fn: (def: COL_DEF_TYPE) => COL_DEF_TYPE): this {
        return this.transform(
            this.columnStore,
            this.defs.map(fn),
            `Updated column defs`,
            TransformType.UpdateColumnDefs
        )
    }

    select(slugs: ColumnSlug[]): this {
        const columnsToKeep = new Set(slugs)
        const newStore: CoreColumnStore = {}
        const defs = this.columnsAsArray
            .filter((col) => columnsToKeep.has(col.slug))
            .map((col) => col.def) as COL_DEF_TYPE[]

        Object.keys(this.columnStore)
            .filter((slug) => columnsToKeep.has(slug))
            .forEach((slug) => {
                newStore[slug] = this.columnStore[slug]
            })

        return this.transform(
            newStore,
            defs,
            `Kept columns '${slugs}'`,
            TransformType.FilterColumns
        )
    }

    dropColumns(slugs: ColumnSlug[], message?: string): this {
        const columnsToDrop = new Set(slugs)
        const newStore = {
            ...this.columnStore,
        }
        const defs = this.columnsAsArray
            .filter((col) => !columnsToDrop.has(col.slug))
            .map((col) => col.def) as COL_DEF_TYPE[]
        slugs.forEach((slug) => {
            delete newStore[slug]
        })
        return this.transform(
            newStore,
            defs,
            message ?? `Dropped columns '${slugs}'`,
            TransformType.FilterColumns
        )
    }

    isRowEmpty(index: number): boolean {
        const { columnStore } = this
        return (
            this.columnSlugs
                .map((slug) => columnStore[slug][index])
                .filter((value) => isNotErrorValue(value) && value !== "")
                .length === 0
        )
    }

    dropEmptyRows(): this {
        return this.dropRowsAt(
            this.indices
                .map((index) => (this.isRowEmpty(index) ? index : null))
                .filter(isPresent)
        )
    }

    renameColumn(oldSlug: ColumnSlug, newSlug: ColumnSlug): this {
        return this.renameColumns({ [oldSlug]: newSlug })
    }

    // Todo: improve typings. After renaming a column the row interface should change. Applies to some other methods as well.
    renameColumns(columnRenameMap: { [columnSlug: string]: ColumnSlug }): this {
        const oldSlugs = Object.keys(columnRenameMap)
        const newSlugs = Object.values(columnRenameMap)

        const message =
            `Renamed ` +
            oldSlugs
                .map((name, index) => `'${name}' to '${newSlugs[index]}'`)
                .join(" and ")

        return this.transform(
            renameColumnStore(this.columnStore, columnRenameMap),
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

    dropRowsAt(indices: number[], message?: string): this {
        const mask = new FilterMask(this.numRows, indices, false)
        if (mask.isNoop())
            return this.noopTransform(message ?? `Dropping 0 rows`)

        return this.transform(
            this.columnStore,
            this.defs,
            message ?? `Dropping ${indices.length} rows`,
            TransformType.FilterRows,
            mask
        )
    }

    replaceCells(
        columnSlugs: ColumnSlug[],
        replaceFn: (val: CoreValueType) => CoreValueType
    ): this {
        const newStore: CoreColumnStore = { ...this.columnStore }
        columnSlugs.forEach((slug) => {
            newStore[slug] = newStore[slug].map(replaceFn)
        })
        return this.transform(
            newStore,
            this.defs,
            `Replaced all cells across columns ${columnSlugs.join(" and ")}`,
            TransformType.UpdateRows
        )
    }

    combineColumns(
        columnSlugs: ColumnSlug[],
        def: COL_DEF_TYPE,
        combineFn: (
            row: Record<ColumnSlug, { value: CoreValueType; time: Time }>,
            time: Time
        ) => CoreValueType
    ): this {
        if (columnSlugs.length === 0) return this
        const newStore: CoreColumnStore = { ...this.columnStore }
        newStore[def.slug] = this.indices.map((index) => {
            const time = this.timeColumn.valuesIncludingErrorValues[index]

            const row: Record<
                ColumnSlug,
                { value: CoreValueType; time: Time }
            > = {}
            columnSlugs.forEach((slug) => {
                row[slug] = {
                    value: this.get(slug).valuesIncludingErrorValues[index],
                    time: this.get(slug).originalTimeColumn
                        .valuesIncludingErrorValues[index] as Time,
                }
            })

            return combineFn(row, time as Time)
        })
        return this.transform(
            newStore,
            [...this.defs, def],
            `Combined columns '${columnSlugs.join(", ")}' into '${def.slug}'`,
            TransformType.CombineColumns
        )
    }

    replaceNonPositiveCellsForLogScale(columnSlugs: ColumnSlug[] = []): this {
        return this.replaceCells(columnSlugs, (val) =>
            typeof val !== "number" || val <= 0
                ? ErrorValueTypes.InvalidOnALogScale
                : val
        )
    }

    replaceNegativeCellsWithErrorValues(columnSlugs: ColumnSlug[] = []): this {
        return this.replaceCells(columnSlugs, (val) =>
            typeof val !== "number" || val < 0
                ? ErrorValueTypes.InvalidNegativeValue
                : val
        )
    }

    replaceNonNumericCellsWithErrorValues(columnSlugs: ColumnSlug[]): this {
        return this.replaceCells(columnSlugs, (val) =>
            !_.isNumber(val) ? ErrorValueTypes.NaNButShouldBeNumber : val
        )
    }

    replaceRandomCells(
        howMany = 1,
        columnSlugs: ColumnSlug[] = [],
        seed = Date.now(),
        replacementGenerator: () => any = (): DroppedForTesting =>
            ErrorValueTypes.DroppedForTesting
    ): this {
        return this.transform(
            replaceRandomCellsInColumnStore(
                this.columnStore,
                howMany,
                columnSlugs,
                seed,
                replacementGenerator
            ),
            this.defs,
            `Replaced a random ${howMany} cells in ${columnSlugs.join(
                " and "
            )}`,
            TransformType.UpdateRows
        )
    }

    appendColumns(defs: COL_DEF_TYPE[]): this {
        return this.transform(
            this.columnStore,
            this.defs.concat(defs),
            `Appended columns ${defs
                .map((def) => `'${def.slug}'`)
                .join(" and ")}`,
            TransformType.AppendColumns
        )
    }

    duplicateColumn(slug: ColumnSlug, overrides: COL_DEF_TYPE): this {
        return this.transform(
            {
                ...this.columnStore,
                [overrides.slug]: this.columnStore[slug],
            },
            this.defs.concat([
                {
                    ...this.get(slug).def,
                    ...overrides,
                },
            ]),
            `Duplicated column '${slug}' to column '${overrides.slug}'`,
            TransformType.AppendColumns
        )
    }

    appendColumnsIfNew(defs: COL_DEF_TYPE[]): this {
        return this.appendColumns(defs.filter((def) => !this.has(def.slug)))
    }

    toMatrix(): any[][] {
        const slugs = this.columnSlugs
        const rows = this.rows.map((row) =>
            slugs.map((slug) =>
                isNotErrorValue(row[slug]) ? row[slug] : undefined
            )
        )
        return [this.columnSlugs, ...rows]
    }

    // Same as toMatrix, but preserves error types
    toTypedMatrix(): any[][] {
        const slugs = this.columnSlugs
        const rows = this.rows.map((row) => slugs.map((slug) => row[slug]))
        return [this.columnSlugs, ...rows]
    }

    concat(tables: CoreTable[], message: string = `Combined tables`): this {
        const all = [this, ...tables] as CoreTable[]
        const defs = all.flatMap((table) => table.defs) as COL_DEF_TYPE[]
        const uniqDefs = _.uniqBy(defs, (def) => def.slug)
        return this.transform(
            concatColumnStores(
                all.map((table) => table.columnStore),
                uniqDefs.map((def) => def.slug)
            ),
            uniqDefs,
            message,
            TransformType.Concat
        )
    }

    /**
     * Ensure a row exists for all values in columnSlug1 × columnSlug2 × ...
     *
     * For example, if we have a table:
     *
     *   ```
     *   entityName, year, …
     *   UK, 2000, …
     *   UK, 2005, …
     *   USA, 2003, …
     *   ```
     *
     * After `complete(["entityName", "year"])`, we'd get:
     *
     *   ```
     *   entityName, year, …
     *   UK, 2000, …
     *   UK, 2003, …
     *   UK, 2005, …
     *   USA, 2000, …
     *   USA, 2003, …
     *   USA, 2005, …
     *   ```
     *
     */
    complete(columnSlugs: [ColumnSlug, ColumnSlug]): this {
        if (columnSlugs.length !== 2)
            throw new Error("Can only run complete() for exactly 2 columns")

        const [slug1, slug2] = columnSlugs
        const col1 = this.get(slug1)
        const col2 = this.get(slug2)

        // The output table will have exactly this many rows, since we assume that [col1, col2] are primary keys
        // (i.e. there are no two rows with the same key), and every combination that doesn't exist yet we will add.
        const cartesianProductSize = col1.numUniqs * col2.numUniqs
        if (this.numRows >= cartesianProductSize) {
            if (this.numRows > cartesianProductSize)
                throw new Error("Table has more rows than expected")

            // Table is already complete
            return this
        }

        // Map that points from a value in col1 to a set of values in col2.
        // It's filled with all the values that already exist in the table, so we
        // can later take the difference.
        const existingRowValues = new Map<CoreValueType, Set<CoreValueType>>()
        for (const index of this.indices) {
            const val1 = col1.values[index]
            const val2 = col2.values[index]
            if (!existingRowValues.has(val1))
                existingRowValues.set(val1, new Set([val2]))
            else existingRowValues.get(val1)!.add(val2)
        }

        // The below code should be as performant as possible, since it's often iterating over hundreds of thousands of rows.
        // The below implementation has been benchmarked against a few alternatives (using flatMap, map, and Array.from), and
        // is the fastest.
        // See https://jsperf.app/zudoye.
        const rowsToAddCol1: CoreValueType[] = []
        const rowsToAddCol2: CoreValueType[] = []
        const col2UniqValuesCount = col2.uniqValuesAsSet.size
        // Add rows for all combinations of values that are not contained in `existingRowValues`.
        for (const val1 of col1.uniqValuesAsSet) {
            const existingVals2 = existingRowValues.get(val1)

            // perf: if all values in col2 are already present for this value in col1, skip
            // this iteration. This is a relatively common case, so we can save some time.
            if (existingVals2?.size === col2UniqValuesCount) continue

            // Find the values in col2 that need to be inserted for this value in col1: col2.uniqValuesAsSet - existingVals2
            const diff = new Set(col2.uniqValuesAsSet)
            for (const val2 of existingVals2 || []) diff.delete(val2)

            for (const val2 of diff) {
                rowsToAddCol1.push(val1)
                rowsToAddCol2.push(val2)
            }
        }
        const appendColumnStore: CoreColumnStore = {
            [slug1]: rowsToAddCol1,
            [slug2]: rowsToAddCol2,
        }
        const appendTable = new (this.constructor as typeof CoreTable)(
            appendColumnStore,
            this.defs,
            { parent: this }
        )

        return this.concat(
            [appendTable],
            `Append missing combos of ${columnSlugs}`
        )
    }

    static getPreposition(col: TimeColumn | CoreColumn): string {
        return col instanceof TimeColumn ? col.preposition : "in"
    }
}

class FilterMask {
    private mask: boolean[]
    private numRows: number
    constructor(
        numRows: number,
        input: boolean[] | number[],
        keepThese = true
    ) {
        this.numRows = numRows
        if (typeof input[0] === "boolean") this.mask = input as boolean[]
        else {
            const set = new Set(input as number[])
            this.mask = _.range(0, numRows).map((index) =>
                set.has(index) ? keepThese : !keepThese
            )
        }
    }

    isNoop(): boolean {
        return this.mask.every((value) => value)
    }

    apply(columnStore: CoreColumnStore): CoreColumnStore {
        const columnsObject: CoreColumnStore = {}
        const keepIndexes: number[] = []
        for (let i = 0; i < this.numRows; i++) {
            if (this.mask[i]) keepIndexes.push(i)
        }

        // Optimization: early return if we're keeping all rows
        if (keepIndexes.length === this.numRows) {
            return columnStore
        }

        Object.keys(columnStore).forEach((slug) => {
            const originalColumn = columnStore[slug]
            const newColumn: CoreValueType[] = new Array(keepIndexes.length)
            for (let i = 0; i < keepIndexes.length; i++) {
                newColumn[i] = originalColumn[keepIndexes[i]]
            }

            columnsObject[slug] = newColumn
        })
        return columnsObject
    }
}

/**
 * Allows you to store your column definitions in CSV/TSV like:
 * slug,name,type etc.
 *
 * todo: define all column def property types
 */
export const columnDefinitionsFromInput = <T extends CoreRow>(
    input: CoreTableInputOption
): T[] =>
    new CoreTable<T>(input).columnFilter(
        "slug",
        (value) => !!value,
        "Keep only column defs with a slug"
    ).rows
