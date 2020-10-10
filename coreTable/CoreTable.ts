import {
    CellValue,
    SortOrder,
    TickFormattingOptions,
    Time,
    TimeTolerance,
    ValueRange,
} from "grapher/core/GrapherConstants"
import {
    formatYear,
    csvEscape,
    anyToString,
    formatDay,
    formatValue,
    parseDelimited,
    slugifySameCase,
    min,
    max,
    sortBy,
    isString,
    last,
    sortedUniq,
    orderBy,
} from "grapher/utils/Util"
import { observable, action, computed } from "mobx"
import {
    ColumnSlug,
    ColumnTypeNames,
    CoreColumnSpec,
    CoreRow,
    EntityName,
} from "./CoreTableConstants"
import {
    AlignedTextTableOptions,
    toAlignedTextTable,
    toDelimited,
    toMarkdownTable,
} from "./CoreTablePrinters"
import { LegacyVariableDisplayConfig } from "./LegacyVariableCode"

// Since authors are uploading data at runtime, and errors in runtime data are extremely common,
// it may be helpful to parse those invalid values into specific types, to provide better error messages
// and perhaps in the future suggested autocorrections or workarounds. Or this could be a dumb idea.
abstract class InvalidValueType {
    value?: any
    constructor(value?: any) {
        this.value = value
    }
    toString() {
        return this.value instanceof InvalidValueType ? "" : this.value ?? ""
    }
    toErrorString() {
        return this.constructor.name
    }
}
class NaNButShouldBeNumber extends InvalidValueType {
    toErrorString() {
        return this.constructor.name + `: '${this.value}'`
    }
}
export class DroppedForTesting extends InvalidValueType {}
class UndefinedButShouldBeNumber extends InvalidValueType {}
class NullButShouldBeNumber extends InvalidValueType {}
class BlankButShouldBeNumber extends InvalidValueType {}
class UndefinedButShouldBeString extends InvalidValueType {}
class NullButShouldBeString extends InvalidValueType {}
class NotAParseableNumberButShouldBeNumber extends InvalidValueType {
    toErrorString() {
        return this.constructor.name + `: '${this.value}'`
    }
}

export abstract class AbstractCoreTable<ROW_TYPE extends CoreRow> {
    private _inputRows: ROW_TYPE[]
    @observable.ref private _rows: ROW_TYPE[]
    @observable private _columns: Map<ColumnSlug, AbstractCoreColumn>
    @observable.shallow protected selectedRows = new Set<CoreRow>()

    protected parent?: AbstractCoreTable<ROW_TYPE>
    private tableDescription?: string

    constructor(
        rows: ROW_TYPE[] = [],
        columnSpecs: CoreColumnSpec[] = [],
        parentTable?: AbstractCoreTable<ROW_TYPE>,
        tableDescription?: string
    ) {
        this._inputRows = rows // Save a reference to original rows for debugging.

        this._columns = new Map()
        columnSpecs.forEach((spec) => {
            const { slug, type } = spec
            const columnType = (type && columnTypeMap[type]) || StringColumn
            this._columns.set(slug, new columnType(this, spec))
        })

        // If this has a parent table, than we expect all specs. This makes "deletes" and "renames" fast.
        // If this is the first input table, then we do a simple check to generate any missing column specs.
        if (!parentTable) this._autodetectAndSpecs(rows)

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
                const spec = AbstractCoreTable.guessColumnSpec(
                    slug,
                    firstRowWithValue
                )
                const columnType = columnTypeMap[spec.type!]
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

    // todo
    copySelectionFrom(table: any) {}

    // For now just examine the first row, and if anything bad is found, reparse that column
    private getColumnsToParse(firstRow: CoreRow) {
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
            this.columnsAsArray.find((col) => col instanceof DateColumn) ||
            this.columnsAsArray.find((col) => col instanceof TimeColumn)
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

    static guessColumnSpec(slug: string, sampleRow: any) {
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

    get rootTable(): AnyTable {
        return this.parent ? this.parent.rootTable : this
    }

    // todo: speed up
    filterBy(predicate: (row: CoreRow) => boolean, opName: string): AnyTable {
        return new (this.constructor as any)(
            this.rows.filter(predicate),
            this.specs,
            this,
            opName
        )
    }

    sortBy(slugs: ColumnSlug[], orders?: SortOrder[]): AnyTable {
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
            .filter((col) => col instanceof NumericColumn)
            .map((col) => col.slug)
    }

    isSelected(row: CoreRow) {
        return this.selectedRows.has(row)
    }

    @action.bound selectRows(rows: CoreRow[]) {
        rows.forEach((row) => {
            this.selectedRows.add(row)
        })
        return this
    }

    @action.bound selectAll() {
        return this.selectRows(this.rows)
    }

    @action.bound deselectRows(rows: CoreRow[]) {
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

    withRows(rows: CoreRow[]): AnyTable {
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
    ): AnyTable {
        return new (this.constructor as any)(
            this.rows,
            this.specs.map(fn),
            this,
            `Updated column specs`
        )
    }

    withoutConstantColumns(): AnyTable {
        const slugs = this.constantColumns().map((col) => col.slug)
        return this.withoutColumns(slugs, `Dropped constant columns '${slugs}'`)
    }

    withoutColumns(slugs: ColumnSlug[], message?: string): AnyTable {
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

    toMatrix() {
        return [this.columnSlugs, ...this.extract()]
    }
}

export declare type ObjectOfColumnSpecs = {
    [columnSlug: string]: CoreColumnSpec
}

// An AnyTable is a Table with 0 or more columns of any type.
export class AnyTable extends AbstractCoreTable<CoreRow> {
    static fromDelimited(csvOrTsv: string, specs?: CoreColumnSpec[]) {
        return new AnyTable(
            this.standardizeSlugs(parseDelimited(csvOrTsv)),
            specs
        )
    }

    private static standardizeSlugs(rows: CoreRow[]) {
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
}

// Todo: Add DayColumn, YearColumn, EntityColumn, etc?

// todo: remove
const rowTime = (row: CoreRow) =>
    parseInt(row.time ?? row.year ?? row.day ?? row.date)

interface ColumnStats {
    numParseErrors: number
    uniqueValues: number
    numValues: number
}

interface ExtendedColumnStats extends ColumnStats {
    median: number | string
    sum: number
    mean: number
    min: number
    max: number
    range: number
    mode: number
    modeSize: number
    deciles: { [which: number]: number }
}

export abstract class AbstractCoreColumn {
    spec: CoreColumnSpec
    table: AbstractCoreTable<CoreRow>

    constructor(table: AbstractCoreTable<CoreRow>, spec: CoreColumnSpec) {
        this.table = table
        this.spec = spec
    }

    abstract jsType: string
    isParsed(val: any) {
        return typeof val === this.jsType
    }

    parse(val: any) {
        return val
    }

    @computed get unit() {
        return this.spec.unit || this.display?.unit || ""
    }

    @computed protected get sortedValuesString() {
        return this.parsedValues.slice().sort()
    }

    @computed protected get sortedValuesNumeric() {
        const numericCompare = (av: number, bv: number) =>
            av > bv ? 1 : av < bv ? -1 : 0
        return this.parsedValues.slice().sort(numericCompare)
    }

    @computed get sortedValues() {
        return this.sortedValuesString
    }

    @computed get stats() {
        const { numParseErrors, numValues } = this
        const basicStats: ColumnStats = {
            numParseErrors,
            uniqueValues: this.valuesUniq.length,
            numValues,
        }
        if (!numValues) return basicStats
        const stats: Partial<ExtendedColumnStats> = { ...basicStats }
        const arr = this.sortedValues
        const isNumeric = typeof arr[0] === "number"

        let min = arr[0]
        let max = arr[0]
        let sum = 0
        let mode = undefined
        let modeSize = 0
        let currentBucketValue = undefined
        let currentBucketSize = 0
        for (let index = 0; index < numValues; index++) {
            const value = arr[index]
            sum += value
            if (value > max) max = value
            if (value < min) min = value
            if (value === currentBucketValue) currentBucketSize++
            else {
                currentBucketValue = value
                currentBucketSize = 1
            }
            if (currentBucketSize > modeSize) {
                modeSize = currentBucketSize
                mode = currentBucketValue
            }
        }

        const medianIndex = Math.floor(numValues / 2)
        stats.sum = sum
        stats.median = arr[medianIndex]
        stats.mean = sum / numValues
        stats.min = min
        stats.max = max
        stats.range = max - min
        stats.mode = mode
        stats.modeSize = modeSize
        if (!isNumeric) {
            stats.sum = undefined
            stats.mean = undefined
        }

        stats.deciles = {}
        const deciles = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99, 100]
        deciles.forEach((decile) => {
            let index = Math.floor(numValues * (decile / 100))
            index = index === numValues ? index - 1 : index
            stats.deciles![decile] = arr[index]
        })

        return stats
    }

    // todo: migrate from unitConversionFactor to computed columns instead. then delete this.
    // note: unitConversionFactor is used >400 times in charts and >800 times in variables!!!
    @computed get unitConversionFactor() {
        return this.display.conversionFactor ?? 1
    }

    @computed get isAllIntegers() {
        return this.parsedValues.every((val) => val % 1 === 0)
    }

    @computed get tolerance() {
        return this.display.tolerance ?? 0
        // (this.property === "color" ? Infinity : 0) ... todo: figure out where color was being used
    }

    @computed get domain() {
        return [this.minValue, this.maxValue]
    }

    @computed get display() {
        return this.spec.display || new LegacyVariableDisplayConfig()
    }

    formatValue(value: any) {
        return anyToString(value)
    }

    formatValueForMobile(value: any) {
        return this.formatValue(value)
    }

    formatValueShort(value: any, options?: TickFormattingOptions) {
        return this.formatValue(value)
    }

    formatValueLong(value: any) {
        return this.formatValue(value)
    }

    formatForTick(value: any, options?: TickFormattingOptions) {
        return this.formatValueShort(value, options)
    }

    @computed get numDecimalPlaces() {
        return this.display.numDecimalPlaces ?? 2
    }

    @computed get shortUnit() {
        const shortUnit =
            this.display.shortUnit ?? this.spec.shortUnit ?? undefined
        if (shortUnit !== undefined) return shortUnit

        const unit = this.display?.unit || this.spec.unit || ""

        if (!unit) return ""

        if (unit.length < 3) return unit
        if (new Set(["$", "£", "€", "%"]).has(unit[0])) return unit[0]

        return ""
    }

    // A method for formatting for CSV
    formatForCsv(value: any) {
        return csvEscape(this.formatValue(value))
    }

    // todo: remove/generalize?
    @computed get entityNameMap() {
        return this.mapBy("entityName")
    }

    private mapBy(columnSlug: ColumnSlug) {
        const map = new Map<any, Set<any>>()
        const slug = this.slug
        this.rowsWithValue.forEach((row) => {
            const value = row[slug]
            // For now the behavior is to not overwrite an existing value with an empty one
            if (value === "") return

            const indexVal = row[columnSlug]
            if (!map.has(indexVal)) !map.set(indexVal, new Set())

            map.get(indexVal)!.add(value)
        })

        return map
    }

    @computed get description() {
        return this.spec.description
    }

    @computed get isEmpty() {
        return this.rowsWithValue.length === 0
    }

    @computed get name() {
        return this.spec.name ?? this.spec.slug
    }

    @computed get displayName() {
        return this.display?.name ?? this.name ?? ""
    }

    // todo: is the isString necessary?
    @computed get sortedUniqNonEmptyStringVals() {
        return Array.from(
            new Set(this.parsedValues.filter(isString).filter((i) => i))
        ).sort()
    }

    @computed get slug() {
        return this.spec.slug
    }

    @computed get isProjection() {
        return !!this.display?.isProjection
    }

    // todo: remove
    @computed get entityNames() {
        return this.rowsWithValue.map((row) => row.entityName)
    }

    // todo: remove
    @computed get entityNamesUniq() {
        return new Set<string>(this.entityNames)
    }

    @computed get entityNamesUniqArr(): EntityName[] {
        return Array.from(this.entityNamesUniq)
    }

    // todo: remove
    @computed get valuesUniq(): any[] {
        return Array.from(this.valuesAsSet)
    }

    @computed private get valuesAsSet() {
        return new Set(this.parsedValues)
    }

    @computed private get allValuesAsSet() {
        return new Set(this.allValues)
    }

    // True if the column has only 1 value
    @computed get isConstant() {
        return this.allValuesAsSet.size === 1
    }

    // todo: remove
    @computed get times(): Time[] {
        return this.rowsWithValue.map((row) => rowTime(row))
    }

    @computed get timesUniq() {
        return sortedUniq(this.times)
    }

    @computed get hasMultipleTimes() {
        return this.timesUniq.length > 1
    }

    @computed get timeTarget(): [Time, TimeTolerance] {
        return [this.endTimelineTime, this.tolerance]
    }

    @computed get targetTimes(): [Time, Time] {
        return [this.startTimelineTime, this.endTimelineTime]
    }

    @computed get startTimelineTime() {
        return this.minTime
    }

    @computed get endTimelineTime() {
        return this.maxTime
    }

    @computed get timelineTimes() {
        return this.timesUniq
    }

    @computed get maxTime() {
        return last(this.timesUniq)!
    }

    @computed get minTime() {
        return this.timesUniq[0]
    }

    @computed get minValue() {
        return this.valuesAscending[0]
    }

    @computed get maxValue() {
        return last(this.valuesAscending)!
    }

    @computed private get allValues() {
        const slug = this.spec.slug
        return this.table.rows.map((row) => row[slug])
    }

    @computed private get rowsWithParseErrors() {
        const slug = this.spec.slug
        return this.table.rows.filter(
            (row) => row[slug] instanceof InvalidValueType
        )
    }

    @computed get numParseErrors() {
        return this.rowsWithParseErrors.length
    }

    // Rows containing a value for this column
    @computed get rowsWithValue() {
        const slug = this.spec.slug
        return this.table.rows.filter(
            (row) => !(row[slug] instanceof InvalidValueType)
        )
    }

    // Number of correctly parsed values
    @computed get numValues() {
        return this.rowsWithValue.length
    }

    @computed get parsedValues() {
        const slug = this.spec.slug
        return this.rowsWithValue.map((row) => row[slug])
    }

    @computed get valuesAscending() {
        return sortBy(this.parsedValues)
    }

    @computed get owidRows() {
        return this.rowsWithValue.map((row, index) => {
            return {
                entityName: this.entityNames[index],
                time: this.times[index],
                value: this.parsedValues[index],
            }
        })
    }

    @computed get owidRowsByEntityName() {
        const map = new Map<EntityName, CoreRow[]>()
        this.owidRows.forEach((row) => {
            if (!map.has(row.entityName)) map.set(row.entityName, [])
            map.get(row.entityName)!.push(row)
        })
        return map
    }

    // todo: remove? at least should not be on CoreTable
    @computed get valueByEntityNameAndTime() {
        const valueByEntityNameAndTime = new Map<
            EntityName,
            Map<Time, CellValue>
        >()
        this.owidRows.forEach((row) => {
            if (!valueByEntityNameAndTime.has(row.entityName))
                valueByEntityNameAndTime.set(row.entityName, new Map())
            valueByEntityNameAndTime
                .get(row.entityName)!
                .set(row.time, row.value)
        })
        return valueByEntityNameAndTime
    }

    @computed get latestValuesMap() {
        const map = new Map<EntityName, any>()
        this.rowsWithValue.forEach((row) =>
            map.set(row.entityName, row[this.slug])
        )
        return map
    }

    getLatestValueForEntity(entityName: string) {
        return this.latestValuesMap.get(entityName)
    }
}

export class LoadingColumn extends AbstractCoreColumn {
    jsType = "string"
} // Todo: remove. A placeholder for now. Represents a column that has not loaded yet

class StringColumn extends AbstractCoreColumn {
    jsType = "string"

    parse(val: any) {
        if (val === null) return new NullButShouldBeString()
        if (val === undefined) return new UndefinedButShouldBeString()
        return val.toString() || ""
    }
}

class SeriesAnnotationColumn extends StringColumn {}

class CategoricalColumn extends AbstractCoreColumn {
    jsType = "string"
}
class RegionColumn extends CategoricalColumn {}
class ContinentColumn extends RegionColumn {}
class EntityIdColumn extends CategoricalColumn {}
class EntityCodeColumn extends CategoricalColumn {}
class EntityNameColumn extends CategoricalColumn {}
class ColorColumn extends CategoricalColumn {}
class BooleanColumn extends AbstractCoreColumn {
    jsType = "boolean"

    parse(val: any) {
        return !!val
    }
}
export class NumericColumn extends AbstractCoreColumn {
    jsType = "number"
    formatValueShort(value: number, options?: TickFormattingOptions) {
        const numDecimalPlaces = this.numDecimalPlaces
        return formatValue(value, {
            unit: this.shortUnit,
            numDecimalPlaces,
            ...options,
        })
    }

    @computed get sortedValues() {
        return this.sortedValuesNumeric
    }

    formatValueLong(value: number) {
        const { unit, numDecimalPlaces } = this
        return formatValue(value, {
            unit,
            numDecimalPlaces,
        })
    }

    parse(val: any): number | InvalidValueType {
        if (val === null) return new NullButShouldBeNumber()
        if (val === undefined) return new UndefinedButShouldBeNumber()
        if (val === "") return new BlankButShouldBeNumber()
        if (isNaN(val)) return new NaNButShouldBeNumber()

        const res = this._parse(val)

        if (isNaN(res)) return new NotAParseableNumberButShouldBeNumber(val)

        return res
    }

    protected _parse(val: any) {
        return parseFloat(val)
    }
}

class IntegerColumn extends NumericColumn {
    formatValue(value: number) {
        if (value === undefined) return ""
        return formatValue(value, {
            numDecimalPlaces: 0,
            noTrailingZeroes: false,
            numberPrefixes: true,
            shortNumberPrefixes: true,
        })
    }

    protected _parse(val: any) {
        return parseInt(val)
    }
}

abstract class TimeColumn extends AbstractCoreColumn {
    jsType = "number"

    parse(val: any) {
        return parseInt(val)
    }

    @computed get sortedValues() {
        return this.sortedValuesNumeric
    }
}

class YearColumn extends TimeColumn {
    formatValue(value: number) {
        // Include BCE
        return formatYear(value)
    }

    formatForCsv(value: number) {
        // Don't include BCE in CSV exports.
        return anyToString(value)
    }
}

class DateColumn extends TimeColumn {
    formatValue(value: number) {
        return formatDay(value)
    }

    formatValueForMobile(value: number) {
        return formatDay(value, { format: "MMM D, 'YY" })
    }

    formatForCsv(value: number) {
        return formatDay(value, { format: "YYYY-MM-DD" })
    }
}

class CurrencyColumn extends NumericColumn {
    formatValue(value: number) {
        return formatValue(value, {
            numDecimalPlaces: 0,
            noTrailingZeroes: false,
            numberPrefixes: false,
            unit: "$",
        })
    }
}
// Expects 50% to be 50
class PercentageColumn extends NumericColumn {
    formatValue(value: number) {
        return formatValue(value, {
            numDecimalPlaces: 0,
            noTrailingZeroes: false,
            numberPrefixes: false,
            unit: "%",
        })
    }

    formatValueShort(value: any) {
        return this.formatValue(value)
    }
}

// Same as %, but indicates it's part of a group of columns that add up to 100%.
// Might not need this.
class RelativePercentageColumn extends PercentageColumn {}

class PercentChangeOverTimeColumn extends PercentageColumn {
    formatValue(value: number) {
        return "+" + super.formatValue(value)
    }
}

// Expectes 50% to be .5
class DecimalPercentageColumn extends NumericColumn {
    formatValue(value: number) {
        return formatValue(value * 100, {
            numDecimalPlaces: 0,
            noTrailingZeroes: false,
            numberPrefixes: false,
            unit: "%",
        })
    }
}
class PopulationColumn extends IntegerColumn {}
class PopulationDensityColumn extends NumericColumn {
    formatValue(value: number) {
        return formatValue(value, {
            numDecimalPlaces: 0,
            noTrailingZeroes: false,
            numberPrefixes: false,
        })
    }
}
class AgeColumn extends NumericColumn {
    formatValue(value: number) {
        return formatValue(value, {
            numDecimalPlaces: 1,
            noTrailingZeroes: false,
            numberPrefixes: false,
        })
    }
}
class RatioColumn extends NumericColumn {
    formatValue(value: number) {
        return formatValue(value, {
            numDecimalPlaces: 1,
            noTrailingZeroes: false,
            numberPrefixes: true,
        })
    }
}

const columnTypeMap: { [key in ColumnTypeNames]: any } = {
    String: StringColumn,
    SeriesAnnotation: SeriesAnnotationColumn,
    Categorical: CategoricalColumn,
    Region: RegionColumn,
    Continent: ContinentColumn,
    Numeric: NumericColumn,
    Date: DateColumn,
    Year: YearColumn,
    Boolean: BooleanColumn,
    Currency: CurrencyColumn,
    Percentage: PercentageColumn,
    RelativePercentage: RelativePercentageColumn,
    Integer: IntegerColumn,
    DecimalPercentage: DecimalPercentageColumn,
    Population: PopulationColumn,
    PopulationDensity: PopulationDensityColumn,
    Age: AgeColumn,
    PercentChangeOverTime: PercentChangeOverTimeColumn,
    Ratio: RatioColumn,
    Color: ColorColumn,
    EntityCode: EntityCodeColumn,
    EntityId: EntityIdColumn,
    EntityName: EntityNameColumn,
}
