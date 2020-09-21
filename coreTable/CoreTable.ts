import {
    CellValue,
    Integer,
    TickFormattingOptions,
    Time,
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
    computeRollingAverage,
    insertMissingValuePlaceholders,
} from "grapher/utils/Util"
import {
    cloneDeep,
    uniq,
    sortBy,
    isString,
    last,
    sortedUniq,
    flatten,
} from "lodash"
import { observable, action, computed } from "mobx"
import { ColumnSlug, ColumnTypeNames, EntityName } from "./CoreTableConstants"
import {
    LegacyVariableDisplayConfig,
    LegacyVariableDisplayConfigInterface,
} from "./LegacyVariableCode"

export interface CoreRow {
    [columnName: string]: any
}

export interface CoreColumnSpec {
    slug: ColumnSlug
    name?: string
    description?: string
    unit?: string
    shortUnit?: string
    fn?: ComputedColumnFn
    type?: ColumnTypeNames
    range?: ValueRange // A range of values to use when generating synthetic data for testing
    display?: LegacyVariableDisplayConfigInterface // todo: move to OwidTable
}

export abstract class AbstractCoreTable<ROW_TYPE extends CoreRow> {
    @observable.ref private _rows: ROW_TYPE[] = []
    @observable protected columns: Map<
        ColumnSlug,
        AbstractCoreColumn
    > = new Map()

    constructor(
        rows: ROW_TYPE[],
        columnSpecs:
            | MapOfColumnSpecs
            | CoreColumnSpec[]
            | ObjectOfColumnSpecs = AbstractCoreTable.makeSpecsFromRows(rows),
        cloneRows = true
    ) {
        this.load(rows, columnSpecs, cloneRows)
        // Todo: add warning if you provide Specs but not for all cols?
    }

    // Todo: remove? Generally do not call this method. Call the constructor instead. RAII style.
    @action.bound protected load(
        rows: ROW_TYPE[],
        columnSpecs:
            | MapOfColumnSpecs
            | CoreColumnSpec[]
            | ObjectOfColumnSpecs = AbstractCoreTable.makeSpecsFromRows(rows),
        cloneRows = true
    ) {
        // Allow skipping of the clone for perf gains.
        if (cloneRows) this.cloneAndSetRows(rows)
        else this.setRowsWithoutCloning(rows)
        this.addSpecs(columnSpecs)
        return this
    }

    @computed get rows() {
        return this._rows
    }

    get(columnSlug: ColumnSlug) {
        return this.columns.get(columnSlug)
    }

    has(columnSlug: ColumnSlug) {
        return this.columns.has(columnSlug)
    }

    // TODO: remove this. Currently we use this to get the right day/year time formatting. For now a chart is either a "day chart" or a "year chart".
    // But we can have charts with multiple time columns. Ideally each place that needs access to the timeColumn, would get the specific column
    // and not the first time column from the table.
    @computed get timeColumn() {
        // For now, return a day column first if present. But see note above about removing this method.
        const col =
            this.columnsAsArray.find((col) => col instanceof DateColumn) ||
            this.columnsAsArray.find((col) => col instanceof TimeColumn)
        return col
    }

    // Todo: remove this. Generally this should not be called until the data is loaded. Even then, all calls should probably be made
    // on the column itself, and not tied tightly to the idea of a time column.
    @computed get timeColumnFormatFunction() {
        return this.timeColumn ? this.timeColumn.formatValue : formatYear
    }

    formatTime(value: any) {
        return this.timeColumnFormatFunction(value)
    }

    // The name is explicit to warn that these rows may be modified by this class.
    setRowsWithoutCloning(rows: ROW_TYPE[]) {
        this._rows = rows
    }

    cloneAndSetRows(rows: ROW_TYPE[]) {
        this._rows = cloneDeep(rows)
    }

    @action.bound addSpecs(
        columnSpecs: MapOfColumnSpecs | ObjectOfColumnSpecs | CoreColumnSpec[],
        overwriteExistingSpec = false
    ) {
        if (Array.isArray(columnSpecs))
            columnSpecs = new Map(columnSpecs.map((spec) => [spec.slug, spec]))
        else if (!(columnSpecs instanceof Map))
            columnSpecs = new Map(
                Object.entries(columnSpecs as ObjectOfColumnSpecs)
            )
        const specs = columnSpecs as MapOfColumnSpecs
        const cols = this.columns
        Array.from(specs.keys()).forEach((slug) => {
            const spec = specs.get(slug)!
            const columnType =
                (spec.type && columnTypeMap[spec.type]) || AnyColumn
            // At the moment we do not overwrite existing columns
            if (overwriteExistingSpec || !cols.has(slug))
                cols.set(slug, new columnType(this, spec))
        })
    }

    static guessColumnSpec(slug: string) {
        if (slug === "day")
            return {
                slug: "day",
                type: ColumnTypeNames.Date,
                name: "Date",
            }
        else if (slug === "year")
            return {
                slug: "year",
                type: ColumnTypeNames.Year,
                name: "Year",
            }
        return { slug }
    }

    static makeSpecsFromRows(rows: any[]): MapOfColumnSpecs {
        const map = new Map()
        // Todo: type detection
        rows.forEach((row) => {
            Object.keys(row).forEach((slug) => {
                map.set(slug, AbstractCoreTable.guessColumnSpec(slug))
            })
        })
        return map
    }

    @action.bound deleteColumnBySlug(slug: ColumnSlug) {
        this.rows.forEach((row) => delete row[slug])
        this.columns.delete(slug)
    }

    @action.bound addFilterColumn(
        slug: ColumnSlug,
        predicate: ComputedColumnFn
    ) {
        this._addComputedColumn(new FilterColumn(this, { slug, fn: predicate }))
    }

    @action.bound addSelectionColumn(
        slug: ColumnSlug,
        predicate: (row: CoreRow) => boolean
    ) {
        this._addComputedColumn(
            new SelectionColumn(this, { slug, fn: predicate })
        )
    }

    private _addComputedColumn(column: AbstractCoreColumn) {
        const slug = column.spec.slug
        this.columns.set(slug, column)
        const fn = column.spec.fn!
        this.rows.forEach((row, index) => {
            ;(row as any)[slug] = fn(row, index, this)
        })
    }

    @action.bound addStringColumnSpec(spec: CoreColumnSpec) {
        this.columns.set(spec.slug, new StringColumn(this, spec))
        return this
    }

    @action.bound addCategoricalColumnSpec(spec: CoreColumnSpec) {
        this.columns.set(spec.slug, new CategoricalColumn(this, spec))
        return this
    }

    @action.bound addNumericComputedColumn(
        spec: CoreColumnSpec & HasComputedColumn
    ) {
        this._addComputedColumn(new NumericColumn(this, spec))
        return this
    }

    // todo: this won't work when adding rows dynamically
    @action.bound addRollingAverageColumn(
        spec: CoreColumnSpec,
        windowSize: Integer,
        valueAccessor: (row: CoreRow) => any,
        dateColName: ColumnSlug,
        groupBy: ColumnSlug,
        multiplier = 1,
        intervalChange?: number,
        transformation: (fn: ComputedColumnFn) => ComputedColumnFn = (fn) => (
            row,
            index
        ) => fn(row, index)
    ) {
        const averages = computeRollingAveragesForEachGroup(
            this.rows,
            valueAccessor,
            groupBy,
            dateColName,
            windowSize
        )

        const computeIntervalTotals: ComputedColumnFn = (row, index) => {
            const val = averages[index!]
            if (!intervalChange) return val ? val * multiplier : val
            const previousValue = averages[index! - intervalChange]
            return previousValue === undefined || previousValue === 0
                ? undefined
                : (100 * (val - previousValue)) / previousValue
        }

        this._addComputedColumn(
            new NumericColumn(this, {
                ...spec,
                fn: transformation(computeIntervalTotals),
            })
        )
    }

    @computed get columnsByName() {
        const map = new Map<string, AbstractCoreColumn>()
        this.columns.forEach((col) => {
            map.set(col.name, col)
        })
        return map
    }

    @computed get columnSlugs() {
        return Array.from(this.columns.keys())
    }

    @computed get numericColumnSlugs() {
        return this.columnsAsArray
            .filter((col) => col instanceof NumericColumn)
            .map((col) => col.slug)
    }

    @computed get isSelectedFn() {
        const selectionColumnSlugs = this.selectionColumnSlugs
        return selectionColumnSlugs.length
            ? (row: CoreRow) => selectionColumnSlugs.some((slug) => row[slug])
            : undefined
    }

    isSelected(row: CoreRow) {
        return this.isSelectedFn && this.isSelectedFn(row)
    }

    @computed get selectedRows() {
        const isSelectedFn = this.isSelectedFn
        return isSelectedFn ? this.rows.filter((row) => isSelectedFn(row)) : []
    }

    @computed get unselectedRows() {
        const isSelectedFn = this.isSelectedFn
        return isSelectedFn
            ? this.rows.filter((row) => !isSelectedFn(row))
            : this.rows
    }

    // todo: remove?
    getLabelForEntityName(entityName: string) {
        return entityName
    }

    @computed get unselectedEntityNames() {
        return this.unselectedRows.map((row) => row.entityName)
    }

    @computed get selectedEntityNames() {
        return uniq(this.selectedRows.map((row) => row.entityName))
    }

    @computed get hasSelection() {
        return this.selectedEntityNames.length
    }

    // Currently only used for debugging
    get filteredRows() {
        const unfiltered = new Set(this.unfilteredRows)
        return this.rows.filter((row) => !unfiltered.has(row))
    }

    @computed get unfilteredRows() {
        const filterFn = this.combinedFilterFn
        const res = this.filterColumns.length
            ? this.rows.filter((row) => filterFn(row))
            : this.rows

        return res
    }

    // Todo: probably remove this and do derived tables instead.
    @computed private get combinedFilterFn() {
        const filterColumns = this.filterColumns.filter((col) => col.spec.fn)

        return (row: CoreRow) => {
            return filterColumns.every((col, index) => {
                row[col.slug] = col.spec.fn!(row, index, this)
                return row[col.slug]
            })
        }
    }

    @computed private get filterColumns() {
        return this.columnsAsArray.filter((col) => col instanceof FilterColumn)
    }

    @computed private get selectionColumnSlugs() {
        return this.columnsAsArray
            .filter((col) => col instanceof SelectionColumn)
            .map((col) => col.slug)
    }

    @computed get columnsAsArray() {
        return Array.from(this.columns.values())
    }

    // for debugging
    rowsWith(query: string) {
        const slugs = this.columnSlugs
        return this.rows.filter((row) =>
            slugs
                .map((slug) => `${slug} ${row[slug] ?? ""}`)
                .join(" ")
                .includes(query)
        )
    }

    extract(slugs = this.columnSlugs) {
        return this.rows.map((row) => slugs.map((slug) => row[slug] ?? ""))
    }

    toDebugInfo(showRows = 5) {
        const rowCount = this.rows.length
        showRows = showRows > rowCount ? rowCount : showRows
        return `columns\n${this.columnsAsArray
            .map(
                (col) =>
                    ` slug:${col.slug} type:${col.spec.type} name:${col.name}`
            )
            .join(
                "\n"
            )}\ndata rows 0 - ${showRows} of ${rowCount}\n ${this.toDelimited(
            undefined,
            showRows,
            ",",
            "\n "
        )}`
    }

    toDelimited(
        slugs = this.columnSlugs,
        rowLimit?: number,
        delimiter = ",",
        rowDelimiter = "\n"
    ) {
        const header = slugs.join(delimiter) + rowDelimiter
        const body = this.extract(slugs)
            .slice(0, rowLimit)
            .map((row) => row.join(delimiter))
            .join(rowDelimiter)
        return header + body
    }

    @action.bound cloneAndAddRowsAndDetectColumns(rows: ROW_TYPE[]) {
        this._rows = this.rows.concat(cloneDeep(rows))
        this.addSpecs(AbstractCoreTable.makeSpecsFromRows(rows))
        return this
    }

    // Get all the columns that only have 1 value
    constantColumns() {
        return this.columnsAsArray.filter((col) => col.isConstant)
    }

    toView(): TableView {
        return new TableView(this)
    }
}

// A mutable Table class without observables for simple table ops. Likely will merge with the main Table class.
class TableView {
    private parentTable: AbstractCoreTable<any>
    private rows: CoreRow[]
    private columns: AbstractCoreColumn[]
    constructor(parentTable: AbstractCoreTable<any>) {
        this.parentTable = parentTable
        this.rows = parentTable.rows.slice(0)
        this.columns = parentTable.columnsAsArray.slice(0)
    }

    private sortBy(columnSlug: ColumnSlug) {
        this.rows = sortBy(this.rows, columnSlug)
        return this
    }

    private deleteColumns(columnSlugs: ColumnSlug[]) {
        const deleteThese = new Set(columnSlugs)
        this.columns = this.columns.filter((col) => !deleteThese.has(col.slug))
        return this
    }

    private toCsvWithColumnNames() {
        const delimiter = ","
        const header =
            this.columns.map((col) => csvEscape(col.name)).join(delimiter) +
            "\n"
        const body = this.rows
            .map((row) =>
                this.columns.map((col) => col.formatForCsv(row[col.slug]) ?? "")
            )
            .map((row) => row.join(delimiter))
            .join("\n")
        return header + body
    }

    // Give our users a clean CSV of each Grapher. Assumes an Owid Table with entityName.
    toPrettyCsv() {
        const dropCols = this.parentTable
            .constantColumns()
            .map((col) => col.slug)
        dropCols.push("entityId")
        return this.deleteColumns(dropCols)
            .sortBy("entityName")
            .toCsvWithColumnNames()
    }
}

export declare type MapOfColumnSpecs = Map<ColumnSlug, CoreColumnSpec>
declare type ObjectOfColumnSpecs = { [columnSlug: string]: CoreColumnSpec }

// An AnyTable is a Table with 0 or more columns of any type.
export class AnyTable extends AbstractCoreTable<CoreRow> {
    static fromDelimited(csvOrTsv: string) {
        return new AnyTable(this.standardizeSlugs(parseDelimited(csvOrTsv)))
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

// todo: remove index param?
export declare type ComputedColumnFn = (
    row: CoreRow,
    index?: Integer,
    table?: AbstractCoreTable<CoreRow>
) => any

export interface HasComputedColumn {
    fn: ComputedColumnFn
}

export abstract class AbstractCoreColumn {
    spec: CoreColumnSpec
    table: AbstractCoreTable<CoreRow>

    constructor(table: AbstractCoreTable<CoreRow>, spec: CoreColumnSpec) {
        this.table = table
        this.spec = spec
    }

    @computed get unit() {
        return this.spec.unit || this.display?.unit || ""
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

        const { unit } = this
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
            // For now the behavior is to not overwrite an existing value with a falsey one
            if (value === undefined || value === "") return

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
            new Set(this.rawValues.filter(isString).filter((i) => i))
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
        return this.rowsWithValue.map((row) => row.year ?? row.day!)
    }

    @computed get timesUniq() {
        return sortedUniq(this.times)
    }

    @computed get hasMultipleTimes() {
        return this.timesUniq.length > 1
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
        return this.sortedValues[0]
    }

    @computed get maxValue() {
        return last(this.sortedValues)!
    }

    @computed private get allValues() {
        const slug = this.spec.slug
        return this.table.unfilteredRows.map((row) => row[slug])
    }

    // Rows containing a value for this column
    @computed get rowsWithValue() {
        const slug = this.spec.slug
        return this.table.unfilteredRows.filter(
            (row) => row[slug] !== undefined && row[slug] !== ""
        )
    }

    @computed protected get rawValues() {
        const slug = this.spec.slug
        return this.rowsWithValue.map((row) => row[slug])
    }

    @computed get parsedValues() {
        return this.rawValues
    }

    @computed get sortedValues() {
        return this.parsedValues.slice().sort()
    }

    @computed get owidRows() {
        return this.times.map((time, index) => {
            return {
                entityName: this.entityNames[index],
                time: this.times[index],
                value: this.parsedValues[index],
            }
        })
    }

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

export class LoadingColumn extends AbstractCoreColumn {} // Todo: remove. A placeholder for now. Represents a column that has not loaded yet

class AnyColumn extends AbstractCoreColumn {}
class StringColumn extends AbstractCoreColumn {}

class CategoricalColumn extends AbstractCoreColumn {}
class BooleanColumn extends AbstractCoreColumn {}
class FilterColumn extends BooleanColumn {}
export class SelectionColumn extends BooleanColumn {}
export class NumericColumn extends AbstractCoreColumn {
    formatValueShort(value: number, options?: TickFormattingOptions) {
        const numDecimalPlaces = this.numDecimalPlaces
        return formatValue(value, {
            unit: this.shortUnit,
            numDecimalPlaces,
            ...options,
        })
    }

    formatValueLong(value: number) {
        const { unit, numDecimalPlaces } = this
        return formatValue(value, {
            unit,
            numDecimalPlaces,
        })
    }

    @computed get parsedValues() {
        return this.rawValues.map(parseFloat)
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

    @computed get parsedValues() {
        return this.rawValues.map(parseInt)
    }
}

abstract class TimeColumn extends AbstractCoreColumn {
    @computed get parsedValues() {
        return this.rawValues.map(parseInt)
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
        return value === undefined ? "" : formatDay(value)
    }

    formatValueForMobile(value: number) {
        return formatDay(value, { format: "MMM D, 'YY" })
    }

    formatForCsv(value: number) {
        return value === undefined
            ? ""
            : formatDay(value, { format: "YYYY-MM-DD" })
    }
}

class CurrencyColumn extends NumericColumn {
    formatValue(value: number) {
        if (value === undefined) return ""
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
        if (value === undefined) return ""
        return formatValue(value, {
            numDecimalPlaces: 0,
            noTrailingZeroes: false,
            numberPrefixes: false,
            unit: "%",
        })
    }
}
// Expectes 50% to be .5
class DecimalPercentageColumn extends NumericColumn {
    formatValue(value: number) {
        if (value === undefined) return ""
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
        if (value === undefined) return ""
        return formatValue(value, {
            numDecimalPlaces: 0,
            noTrailingZeroes: false,
            numberPrefixes: false,
        })
    }
}
class AgeColumn extends NumericColumn {
    formatValue(value: number) {
        if (value === undefined) return ""
        return formatValue(value, {
            numDecimalPlaces: 1,
            noTrailingZeroes: false,
            numberPrefixes: false,
        })
    }
}
class RatioColumn extends NumericColumn {
    formatValue(value: number) {
        if (value === undefined) return ""
        return formatValue(value, {
            numDecimalPlaces: 1,
            noTrailingZeroes: false,
            numberPrefixes: true,
        })
    }
}

// Todo: replace with someone else's library
const computeRollingAveragesForEachGroup = (
    rows: CoreRow[],
    valueAccessor: (row: CoreRow) => any,
    groupColName: string,
    dateColName: string,
    rollingAverage: number
) => {
    const groups: number[][] = []
    let currentGroup = rows[0][groupColName]
    let currentRows: CoreRow[] = []
    // Assumes items are sorted by entity
    for (let i = 0; i <= rows.length; i++) {
        const row = rows[i]
        const groupName = row && row[groupColName]

        if (currentGroup !== groupName) {
            const averages = computeRollingAverage(
                insertMissingValuePlaceholders(
                    currentRows.map(valueAccessor),
                    currentRows.map((row) => row[dateColName])
                ),
                rollingAverage
            ).filter((value) => value !== null) as number[]
            groups.push(averages)
            if (!row) break
            currentRows = []
            currentGroup = groupName
        }
        currentRows.push(row)
    }
    return flatten(groups)
}

const columnTypeMap: { [key in ColumnTypeNames]: any } = {
    String: StringColumn,
    Categorical: CategoricalColumn,
    Numeric: NumericColumn,
    Date: DateColumn,
    Year: YearColumn,
    Boolean: BooleanColumn,
    Currency: CurrencyColumn,
    Percentage: PercentageColumn,
    Integer: IntegerColumn,
    DecimalPercentage: DecimalPercentageColumn,
    Population: PopulationColumn,
    PopulationDensity: PopulationDensityColumn,
    Age: AgeColumn,
    Ratio: RatioColumn,
}
