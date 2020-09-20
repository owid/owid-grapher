import {
    LegacyVariableConfig,
    LegacyVariableDisplayConfigInterface,
    LegacyEntityMeta,
    LegacyVariablesAndEntityKey,
    LegacyVariableDisplayConfig,
} from "./LegacyVariableCode"
import {
    slugifySameCase,
    groupBy,
    computeRollingAverage,
    insertMissingValuePlaceholders,
    diffDateISOStringInDays,
    max,
    min,
    flatten,
    sortBy,
    isString,
    cloneDeep,
    parseDelimited,
    intersectionOfSets,
    formatValue,
    anyToString,
    formatDay,
    csvEscape,
    formatYear,
    sortedUniq,
    sortNumeric,
    isNumber,
    last,
    getRandomNumberGenerator,
    range,
    findClosestTimeIndex,
    uniq,
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import {
    CellValue,
    EPOCH_DATE,
    TickFormattingOptions,
    Time,
    Range,
} from "grapher/core/GrapherConstants"
import {
    ColumnTypeNames,
    Year,
    ColumnSlug,
    EntityId,
    EntityCode,
    Integer,
    EntityName,
    LegacyVariableId,
    OwidSource,
} from "./OwidTableConstants"

export interface Row {
    [columnName: string]: any
}

export interface ColumnSpec {
    slug: ColumnSlug
    name?: string
    owidVariableId?: LegacyVariableId
    unit?: string
    shortUnit?: string
    isDailyMeasurement?: boolean
    description?: string
    coverage?: string
    datasetId?: string
    datasetName?: string
    source?: OwidSource
    display?: LegacyVariableDisplayConfigInterface

    // More advanced options:
    annotationsColumnSlug?: ColumnSlug
    fn?: RowToValueMapper

    type?: ColumnTypeNames

    // A range of values to use when generating synthetic data for testing
    range?: Range
}

const globalEntityIds = new Map()
export const generateEntityId = (entityName: string) => {
    if (!globalEntityIds.has(entityName))
        globalEntityIds.set(entityName, globalEntityIds.size)
    return globalEntityIds.get(entityName)
}

// Todo: replace with someone else's library
const computeRollingAveragesForEachGroup = (
    rows: Row[],
    valueAccessor: (row: Row) => any,
    groupColName: string,
    dateColName: string,
    rollingAverage: number
) => {
    const groups: number[][] = []
    let currentGroup = rows[0][groupColName]
    let currentRows: Row[] = []
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

// This is a row with the additional columns specific to our OWID data model
interface OwidRow extends Row {
    entityName: EntityName
    entityCode: EntityCode
    entityId: EntityId
    time: Time
    year?: Year
    day?: Integer
    date?: string
}

// todo: remove index param?
export declare type RowToValueMapper = (
    row: Row,
    index?: Integer,
    table?: AbstractTable<Row>
) => any

export interface ComputedColumnSpec extends ColumnSpec {
    fn: RowToValueMapper
}

export abstract class AbstractColumn {
    spec: ColumnSpec
    table: AbstractTable<Row>

    constructor(table: AbstractTable<Row>, spec: ColumnSpec) {
        this.table = table
        this.spec = spec
    }

    @computed get isDailyMeasurement() {
        return !!this.spec.isDailyMeasurement
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

    @computed get coverage() {
        return this.spec.coverage
    }

    @computed get annotationsColumn() {
        return this.spec.annotationsColumnSlug
            ? this.table.columnsBySlug.get(this.spec.annotationsColumnSlug)
            : undefined
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

    @computed get datasetName() {
        return this.spec.datasetName
    }

    @computed get source() {
        return this.spec.source
    }

    @computed get datasetId() {
        return this.spec.datasetId
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

    formatTime(time: Time) {
        return this.isDailyMeasurement ? formatDay(time) : formatYear(time)
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

export class LoadingColumn extends AbstractColumn {} // Todo: remove. A placeholder for now. Represents a column that has not loaded yet

class AnyColumn extends AbstractColumn {}
class StringColumn extends AbstractColumn {}

class CategoricalColumn extends AbstractColumn {}
class BooleanColumn extends AbstractColumn {}
class FilterColumn extends BooleanColumn {}
class SelectionColumn extends BooleanColumn {}
export class NumericColumn extends AbstractColumn {
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

abstract class TimeColumn extends AbstractColumn {
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
// Todo: Add DayColumn, YearColumn, EntityColumn, etc?

declare type ColumnSpecs = Map<ColumnSlug, ColumnSpec>
declare type ColumnSpecObject = { [columnSlug: string]: ColumnSpec }

abstract class AbstractTable<ROW_TYPE extends Row> {
    @observable.ref private _rows: ROW_TYPE[] = []
    @observable protected columns: Map<ColumnSlug, AbstractColumn> = new Map()

    constructor(
        rows: ROW_TYPE[],
        columnSpecs:
            | ColumnSpecs
            | ColumnSpec[]
            | ColumnSpecObject = AbstractTable.makeSpecsFromRows(rows),
        cloneRows = true
    ) {
        this.load(rows, columnSpecs, cloneRows)
        // Todo: add warning if you provide Specs but not for all cols?
    }

    // Todo: remove? Generally do not call this method. Call the constructor instead. RAII style.
    @action.bound protected load(
        rows: ROW_TYPE[],
        columnSpecs:
            | ColumnSpecs
            | ColumnSpec[]
            | ColumnSpecObject = AbstractTable.makeSpecsFromRows(rows),
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
        return this.columnsBySlug.get(columnSlug)
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

    // The name is explicit to warn that these rows may be modified by this class.
    setRowsWithoutCloning(rows: ROW_TYPE[]) {
        this._rows = rows
    }

    cloneAndSetRows(rows: ROW_TYPE[]) {
        this._rows = cloneDeep(rows)
    }

    @action.bound addSpecs(
        columnSpecs: ColumnSpecs | ColumnSpecObject | ColumnSpec[],
        overwriteExistingSpec = false
    ) {
        if (Array.isArray(columnSpecs))
            columnSpecs = new Map(columnSpecs.map((spec) => [spec.slug, spec]))
        else if (!(columnSpecs instanceof Map))
            columnSpecs = new Map(
                Object.entries(columnSpecs as ColumnSpecObject)
            )
        const specs = columnSpecs as ColumnSpecs
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

    static makeSpecsFromRows(rows: any[]): ColumnSpecs {
        const map = new Map()
        // Todo: type detection
        rows.forEach((row) => {
            Object.keys(row).forEach((slug) => {
                map.set(slug, OwidTable.guessColumnSpec(slug))
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
        predicate: RowToValueMapper
    ) {
        this._addComputedColumn(new FilterColumn(this, { slug, fn: predicate }))
    }

    @action.bound addSelectionColumn(
        slug: ColumnSlug,
        predicate: (row: Row) => boolean
    ) {
        this._addComputedColumn(
            new SelectionColumn(this, { slug, fn: predicate })
        )
    }

    private _addComputedColumn(column: AbstractColumn) {
        const slug = column.spec.slug
        this.columns.set(slug, column)
        const fn = column.spec.fn!
        this.rows.forEach((row, index) => {
            ;(row as any)[slug] = fn(row, index, this)
        })
    }

    @action.bound addStringColumnSpec(spec: ColumnSpec) {
        this.columns.set(spec.slug, new StringColumn(this, spec))
        return this
    }

    @action.bound addCategoricalColumnSpec(spec: ColumnSpec) {
        this.columns.set(spec.slug, new CategoricalColumn(this, spec))
        return this
    }

    @action.bound addNumericComputedColumn(spec: ComputedColumnSpec) {
        this._addComputedColumn(new NumericColumn(this, spec))
        return this
    }

    // todo: this won't work when adding rows dynamically
    @action.bound addRollingAverageColumn(
        spec: ColumnSpec,
        windowSize: Integer,
        valueAccessor: (row: Row) => any,
        dateColName: ColumnSlug,
        groupBy: ColumnSlug,
        multiplier = 1,
        intervalChange?: number,
        transformation: (fn: RowToValueMapper) => RowToValueMapper = (fn) => (
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

        const computeIntervalTotals: RowToValueMapper = (row, index) => {
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

    @computed get columnsBySlug() {
        return this.columns
    }

    @computed get columnsByName() {
        const map = new Map<string, AbstractColumn>()
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
            ? (row: Row) => selectionColumnSlugs.some((slug) => row[slug])
            : undefined
    }

    isSelected(row: Row) {
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
        const res = this.filterColumnSlugs.length
            ? this.rows.filter((row) => filterFn(row))
            : this.rows

        return res
    }

    @computed private get combinedFilterFn() {
        const filterSlugs = this.filterColumnSlugs
        const filterFns = filterSlugs.map(
            (slug) =>
                (this.columnsBySlug.get(slug)!.spec as ComputedColumnSpec).fn
        )
        return (row: Row) => {
            return filterSlugs.every((slug, index) => {
                row[slug] = filterFns[index](row, index, this)
                return row[slug]
            })
        }
    }

    @computed private get filterColumnSlugs() {
        return this.columnsAsArray
            .filter((col) => col instanceof FilterColumn)
            .map((col) => col.slug)
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
        this.addSpecs(AbstractTable.makeSpecsFromRows(rows))
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
    private parentTable: AbstractTable<any>
    private rows: Row[]
    private columns: AbstractColumn[]
    constructor(parentTable: AbstractTable<any>) {
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

export class BasicTable extends AbstractTable<Row> {
    static fromDelimited(csvOrTsv: string) {
        return new BasicTable(this.standardizeSlugs(parseDelimited(csvOrTsv)))
    }

    private static standardizeSlugs(rows: Row[]) {
        const colSpecs = Object.keys(rows[0]).map((name) => {
            return {
                name,
                slug: slugifySameCase(name),
            }
        })
        const colsToRename = colSpecs.filter((col) => col.name !== col.slug)
        if (colsToRename.length) {
            rows.forEach((row: Row) => {
                colsToRename.forEach((col) => {
                    row[col.slug] = row[col.name]
                    delete row[col.name]
                })
            })
        }
        return rows
    }
}

// An OwidTable is a subset of Table. An OwidTable always has EntityName, EntityCode, EntityId, and Time columns,
// and value column(s). Whether or not we need in the long run is uncertain and it may just be a stepping stone
// to go from our Variables paradigm to the Table paradigm.
export class OwidTable extends AbstractTable<OwidRow> {
    static fromDelimited(csvOrTsv: string, specs?: ColumnSpec[]) {
        const parsed = parseDelimited(csvOrTsv)
        const colSlugs = parsed[0] ? Object.keys(parsed[0]) : []

        const missingColumns = OwidTable.requiredColumnSpecs.filter(
            (spec) => !colSlugs.includes(spec.slug)
        )

        if (missingColumns.length)
            throw new Error(
                `Table is missing required OWID columns: '${missingColumns.join(
                    ","
                )}'`
            )

        const table = new OwidTable((parsed as any) as OwidRow[])
        if (specs) table.addSpecs(specs, true)
        table.addSpecs(OwidTable.requiredColumnSpecs, true)
        return table
    }

    clone() {
        return new OwidTable(
            this.rows,
            this.columnsAsArray.map((col) => col.spec)
        )
    }

    @computed get columnsByOwidVarId() {
        const map = new Map<number, AbstractColumn>()
        Array.from(this.columns.values()).forEach((column, index) => {
            map.set(column.spec.owidVariableId ?? index, column)
        })
        return map
    }

    @computed get entityType() {
        return "Country"
    }

    @computed get availableEntityNames() {
        return Array.from(this.availableEntityNameSet)
    }

    @computed get availableEntityNameSet() {
        return new Set(this.rows.map((row) => row.entityName))
    }

    @computed get unfilteredEntities() {
        return new Set(this.unfilteredRows.map((row) => row.entityName))
    }

    // todo: can we remove at some point?
    @computed get entityIdToNameMap() {
        const map = new Map<EntityId, EntityName>()
        this.rows.forEach((row) => {
            map.set(row.entityId, row.entityName)
        })
        return map
    }

    // todo: can we remove at some point?
    @computed get entityCodeToNameMap() {
        const map = new Map<EntityCode, EntityName>()
        this.rows.forEach((row) => {
            if (row.entityCode) map.set(row.entityCode, row.entityName)
            else map.set(row.entityName, row.entityName)
        })
        return map
    }

    // todo: can we remove at some point?
    @computed get entityNameToIdMap() {
        const map = new Map<EntityName, number>()
        this.rows.forEach((row) => {
            map.set(row.entityName, row.entityId)
        })
        return map
    }

    // todo: can we remove at some point?
    @computed get entityNameToCodeMap() {
        const map = new Map<EntityName, EntityCode>()
        this.rows.forEach((row) => {
            map.set(row.entityName, row.entityCode)
        })
        return map
    }

    @computed get entityIndex() {
        const map = new Map<EntityName, OwidRow[]>()
        this.rows.forEach((row) => {
            if (!map.has(row.entityName)) map.set(row.entityName, [])
            map.get(row.entityName)!.push(row)
        })
        return map
    }

    @computed get maxTime() {
        return max(this.allTimes)
    }

    @computed get minTime() {
        return min(this.allTimes)
    }

    @computed get allTimes() {
        return this.rows.filter((row) => row.year).map((row) => row.year!)
    }

    @computed get hasDayColumn() {
        return this.columns.has("day")
    }

    @computed get dayColumn() {
        return this.columns.get("day")
    }

    @computed get rowsByEntityName() {
        const map = new Map<EntityName, OwidRow[]>()
        this.rows.forEach((row) => {
            const name = row.entityName
            if (!map.has(name)) map.set(name, [])
            map.get(name)!.push(row)
        })
        return map
    }

    // one datum per entityName. use the closest value to target year within tolerance.
    // selected rows only. value from any primary column.
    // getClosestRowForEachSelectedEntity(targetYear, tolerance)
    // Make sure we use the closest value to the target year within tolerance (preferring later)
    getClosestRowForEachSelectedEntity(targetTime: Time, tolerance: Integer) {
        const rowMap = this.rowsByEntityName
        const timeSlug = this.timeColumn?.slug
        if (!timeSlug) return []
        return this.selectedEntityNames
            .map((name) => {
                const rows = rowMap.get(name)
                if (!rows) return null

                const rowIndex = findClosestTimeIndex(
                    rows.map((row) => row[timeSlug]) as number[],
                    targetTime,
                    tolerance
                )
                return rowIndex ? rows[rowIndex] : null
            })
            .filter((row) => row) as OwidRow[]
    }

    // Clears and sets selected entities
    @action.bound setSelectedEntities(entityNames: EntityName[]) {
        this.initDefaultEntitySelectionColumn()
        const set = new Set(entityNames)
        this.rows.forEach((row) => {
            row[this.defaultEntitySelectionSlug] = set.has(row.entityName)
        })
    }

    @action.bound clearSelection() {
        this.selectedEntityNames.forEach((name) => {
            this.deselectEntity(name)
        })
    }

    @action.bound selectAll() {
        this.unselectedEntityNames.forEach((name) => {
            this.selectEntity(name)
        })
    }

    @action.bound setSelectedEntitiesByCode(entityCodes: EntityCode[]) {
        const map = this.entityCodeToNameMap
        const codesInData = entityCodes.filter((code) => map.has(code))
        this.setSelectedEntities(codesInData.map((code) => map.get(code)!))
        return codesInData
    }

    @action.bound setSelectedEntitiesByEntityId(entityIds: EntityId[]) {
        const map = this.entityIdToNameMap
        this.setSelectedEntities(entityIds.map((id) => map.get(id)!))
    }

    private defaultEntitySelectionSlug = "is_entity_selected"
    private initDefaultEntitySelectionColumn() {
        if (!this.columnsBySlug.has(this.defaultEntitySelectionSlug))
            this.columns.set(
                this.defaultEntitySelectionSlug,
                new SelectionColumn(this, {
                    slug: this.defaultEntitySelectionSlug,
                })
            )
    }

    isEntitySelected(entityName: EntityName) {
        return this.selectedEntityNameSet.has(entityName)
    }

    @computed get selectedEntityNameSet() {
        return new Set(this.selectedEntityNames)
    }

    @computed get selectedEntityCodes() {
        const map = this.entityNameToCodeMap
        return Array.from(this.selectedEntityNameSet)
            .map((name) => map.get(name))
            .filter((code) => code) as string[]
    }

    getColorForEntityName(entityName: string) {
        // Todo: restore Grapher keycolors functionality
        const colors = {
            Africa: "#923E8B",
            Antarctica: "#5887A1",
            Asia: "#2D8587",
            Europe: "#4C5C78",
            "North America": "#E04E4B",
            Oceania: "#A8633C",
            "South America": "#932834",
        }
        return Object.values(colors)[entityName.charCodeAt(0) % 7]
    }

    @action.bound toggleSelection(entityName: EntityName) {
        if (this.isEntitySelected(entityName)) this.deselectEntity(entityName)
        else this.selectEntity(entityName)
    }

    @action.bound selectEntity(entityName: EntityName) {
        this.initDefaultEntitySelectionColumn()

        this.rowsByEntityName
            .get(entityName)
            ?.forEach((row) => (row[this.defaultEntitySelectionSlug] = true))
        return this
    }

    @action.bound deselectEntity(entityName: EntityName) {
        this.rowsByEntityName
            .get(entityName)
            ?.forEach((row) => delete row[this.defaultEntitySelectionSlug])
        return this
    }

    specToObject() {
        const output: any = {}
        Array.from(this.columns.values()).forEach((col) => {
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

    entitiesWith(columnSlugs: string[]): Set<string> {
        if (!columnSlugs.length) return new Set()
        if (columnSlugs.length === 1)
            return this.columnsBySlug.get(columnSlugs[0])!.entityNamesUniq

        return intersectionOfSets<string>(
            columnSlugs.map(
                (slug) => this.columnsBySlug.get(slug)!.entityNamesUniq
            )
        )
    }

    private static annotationsToMap(annotations: string) {
        // Todo: let's delete this and switch to traditional columns
        const entityAnnotationsMap = new Map<string, string>()
        const delimiter = ":"
        annotations.split("\n").forEach((line) => {
            const [key, ...words] = line.split(delimiter)
            entityAnnotationsMap.set(key.trim(), words.join(delimiter).trim())
        })
        return entityAnnotationsMap
    }

    static makeAnnotationColumnSlug(columnSlug: ColumnSlug) {
        return columnSlug + "-annotations"
    }

    private static columnSpecFromLegacyVariable(
        variable: LegacyVariableConfig
    ): ColumnSpec {
        const slug = variable.id.toString() // For now, the variableId will be the column slug
        const {
            unit,
            shortUnit,
            description,
            coverage,
            datasetId,
            datasetName,
            source,
            display,
        } = variable

        // Without this the much used var 123 appears as "Countries Continent". We could rename in Grapher but not sure the effects of that.
        const name = variable.id == 123 ? "Continent" : variable.name

        return {
            name,
            slug,
            isDailyMeasurement: variable.display?.yearIsDay,
            unit,
            shortUnit,
            description,
            coverage,
            datasetId,
            datasetName,
            display,
            source,
            owidVariableId: variable.id,
            type: ColumnTypeNames.Numeric,
        }
    }

    static requiredColumnSpecs: ColumnSpec[] = [
        {
            name: "Entity",
            slug: "entityName",
            type: ColumnTypeNames.Categorical,
        },
        {
            slug: "entityId",
            type: ColumnTypeNames.Categorical,
        },
        {
            name: "Code",
            slug: "entityCode",
            type: ColumnTypeNames.Categorical,
        },
    ]

    static legacyVariablesToTabular(json: LegacyVariablesAndEntityKey) {
        let rows: OwidRow[] = []
        const entityMetaById: { [id: string]: LegacyEntityMeta } =
            json.entityKey
        const columnSpecs: ColumnSpecs = new Map()
        OwidTable.requiredColumnSpecs.forEach((spec) => {
            columnSpecs.set(spec.slug, spec)
        })

        for (const key in json.variables) {
            const variable = json.variables[key]

            const entityNames =
                variable.entities?.map((id) => entityMetaById[id].name) || []
            const entityCodes =
                variable.entities?.map((id) => entityMetaById[id].code) || []

            const columnSpec = OwidTable.columnSpecFromLegacyVariable(variable)
            const columnSlug = columnSpec.slug
            columnSpec.isDailyMeasurement
                ? columnSpecs.set("day", {
                      slug: "day",
                      type: ColumnTypeNames.Date,
                      name: "Date",
                  })
                : columnSpecs.set("year", {
                      slug: "year",
                      type: ColumnTypeNames.Year,
                      name: "Year",
                  })
            columnSpecs.set(columnSlug, columnSpec)

            // todo: remove. move annotations to their own first class column.
            let annotationsColumnSlug: string
            let annotationMap: Map<string, string>
            if (variable.display?.entityAnnotationsMap) {
                annotationsColumnSlug = OwidTable.makeAnnotationColumnSlug(
                    columnSlug
                )
                annotationMap = OwidTable.annotationsToMap(
                    variable.display.entityAnnotationsMap
                )
                columnSpecs.set(annotationsColumnSlug, {
                    slug: annotationsColumnSlug,
                    type: ColumnTypeNames.String,
                    name: `${columnSpec.name} Annotations`,
                })
                columnSpec.annotationsColumnSlug = annotationsColumnSlug
            }

            const timeColumnName = columnSpec.isDailyMeasurement
                ? "day"
                : "year"

            // Todo: remove
            const display = variable.display
            const yearsNeedTransform =
                display &&
                display.yearIsDay &&
                display.zeroDay !== undefined &&
                display.zeroDay !== EPOCH_DATE
            const yearsRaw = variable.years || []
            const years =
                yearsNeedTransform && display
                    ? OwidTable.convertLegacyYears(yearsRaw, display.zeroDay!)
                    : yearsRaw

            const values = variable.values || []
            const entities = variable.entities || []

            const newRows = values.map((value, index) => {
                const entityName = entityNames[index]
                const time = years[index]
                const row: OwidRow = {
                    [timeColumnName]: time,
                    time,
                    [columnSlug]: value,
                    entityName,
                    entityId: entities[index],
                    entityCode: entityCodes[index],
                }
                if (annotationsColumnSlug)
                    row[annotationsColumnSlug] = annotationMap.get(entityName)
                return row
            })
            rows = rows.concat(newRows)
        }
        const groupMap = groupBy(rows, (row) => {
            const timePart =
                row.year !== undefined ? `year:${row.year}` : `day:${row.day}`
            return timePart + " " + row.entityName
        })

        const joinedRows: OwidRow[] = Object.keys(groupMap).map((groupKey) =>
            Object.assign({}, ...groupMap[groupKey])
        )

        return {
            rows: sortBy(joinedRows, ["year", "day"]),
            columnSpecs,
        }
    }

    // todo: move "unit conversions" to computed columns
    @action.bound applyUnitConversionAndOverwriteLegacyColumn(
        unitConversionFactor: number,
        variableId: LegacyVariableId
    ) {
        const sourceColumn = this.columnsByOwidVarId.get(variableId)!
        this.addNumericComputedColumn({
            ...sourceColumn.spec,
            fn: (row) => row[sourceColumn.slug] * unitConversionFactor,
        })
    }

    @action.bound loadFromLegacy(json: LegacyVariablesAndEntityKey) {
        const { rows, columnSpecs } = OwidTable.legacyVariablesToTabular(json)
        return this.load(rows, columnSpecs, false)
    }

    // todo: remove
    private static convertLegacyYears(years: number[], zeroDay: string) {
        // Only shift years if the variable zeroDay is different from EPOCH_DATE
        // When the dataset uses days (`yearIsDay == true`), the days are expressed as integer
        // days since the specified `zeroDay`, which can be different for different variables.
        // In order to correctly join variables with different `zeroDay`s in a single chart, we
        // normalize all days to be in reference to a single epoch date.
        const diff = diffDateISOStringInDays(zeroDay, EPOCH_DATE)
        return years.map((y) => y + diff)
    }
}

interface SynthOptions {
    countryCount: number
    timeRange: Range
    columnSpecs: ColumnSpec[]
}

// Generate a fake table for testing
export const SynthesizeOwidTable = (
    options?: Partial<SynthOptions>,
    seed = Date.now()
) => {
    const finalOptions = {
        countryCount: 2,
        timeRange: [1950, 2020],
        columnSpecs: [
            { slug: "Population", type: "Population", range: [1e6, 1e8] },
            { slug: "GDP", type: "Currency", range: [1e6, 1e8] },
        ] as ColumnSpec[],
        ...options,
    }
    const { countryCount, columnSpecs, timeRange } = finalOptions
    const colSlugs = ["entityName", "entityCode", "entityId", "year"].concat(
        columnSpecs.map((col) => col.slug!)
    )

    const valueGenerators = columnSpecs.map((col, index) =>
        getRandomNumberGenerator(col.range![0], col.range![1], seed + index)
    )

    // todo: support N countries
    const countries = [
        "Germany",
        "France",
        "Iceland",
        "Australia",
        "China",
        "Nigeria",
        "Brazil",
        "Canada",
        "Fiji",
        "Japan",
    ].slice(0, countryCount)

    const rows = countries.map((country, index) =>
        range(timeRange[0], timeRange[1])
            .map((year) =>
                [
                    country,
                    country.substr(0, 3).toUpperCase(),
                    index,
                    year,
                    ...columnSpecs.map((slug, index) =>
                        valueGenerators[index]()
                    ),
                ].join(",")
            )
            .join("\n")
    )

    const table = OwidTable.fromDelimited(
        `${colSlugs.join(",")}\n${rows.join("\n")}`,
        columnSpecs
    )

    return table
}
