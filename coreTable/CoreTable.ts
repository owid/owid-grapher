import {
    CellValue,
    Integer,
    TickFormattingOptions,
    Time,
    TimeTolerance,
} from "grapher/core/GrapherConstants"
import {
    formatYear,
    csvEscape,
    anyToString,
    formatDay,
    formatValue,
    parseDelimited,
    slugifySameCase,
} from "grapher/utils/Util"
import { sortBy, isString, last, sortedUniq } from "lodash"
import { observable, action, computed } from "mobx"
import { ColumnSlug, ColumnTypeNames, EntityName } from "./CoreTableConstants"
import {
    toAlignedTextTable,
    toDelimited,
    toMarkdownTable,
} from "./CoreTablePrinters"
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
    generator?: (...params: any[]) => number // A function for generating synthetic data for testing
    display?: LegacyVariableDisplayConfigInterface // todo: move to OwidTable
}

export abstract class AbstractCoreTable<ROW_TYPE extends CoreRow> {
    @observable.ref protected _rows: ROW_TYPE[]
    @observable protected _columns: Map<
        ColumnSlug,
        AbstractCoreColumn
    > = new Map()
    @observable.shallow protected selectedRows = new Set<CoreRow>()

    protected parent?: AbstractCoreTable<ROW_TYPE>
    protected tableDescription?: string

    constructor(
        rows: ROW_TYPE[] = [],
        columnSpecs: CoreColumnSpec[] = AbstractCoreTable.makeSpecsFromRows(
            rows
        ),
        parentTable?: AbstractCoreTable<ROW_TYPE>,
        tableDescription?: string
    ) {
        this._rows = rows
        this.setColumns(columnSpecs)
        // Todo: add warning if you provide Specs but not for all cols?
        this.parent = parentTable

        // Clone selection from parent
        if (parentTable)
            this.selectRows(
                this.rows.filter((row) => parentTable.selectedRows.has(row))
            )

        this.tableDescription = tableDescription
    }

    // Todo: make immutable? Return a new table?
    private setColumns(columnSpecs: CoreColumnSpec[]) {
        const cols = this._columns
        columnSpecs.forEach((spec) => {
            const { slug, type } = spec
            const columnType = (type && columnTypeMap[type]) || AnyColumn
            cols.set(slug, new columnType(this, spec))
        })

        // Todo: clone rows before doing this, to ensure immutability.
        // Set computeds
        const computeds = columnSpecs.filter((spec) => spec.fn)

        if (!computeds.length) return

        // Clone rows
        this._rows = this._rows.map((row, index) => {
            const newRow: any = { ...row }
            computeds.forEach((spec) => {
                newRow[spec.slug] = spec.fn!(row, index, this)
            })
            return newRow as ROW_TYPE
        })
    }

    // Todo: REMOVE. make immutable. Return a new table.
    @action.bound addColumnSpecs(columnSpecs: CoreColumnSpec[]) {
        this.setColumns(columnSpecs)
    }

    @computed get rows() {
        return this._rows
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

    static makeSpecsFromRows(rows: any[]) {
        const map: ObjectOfColumnSpecs = {}
        // Todo: type detection
        // todo: just sample a few rows?
        rows.forEach((row) => {
            Object.keys(row).forEach((slug) => {
                map[slug] = AbstractCoreTable.guessColumnSpec(slug)
            })
        })
        return Object.values(map)
    }

    get rootTable(): AnyTable {
        return this.parent ? this.parent.rootTable : this
    }

    // todo: speed up
    filterBy(predicate: (row: CoreRow) => boolean, opName: string): AnyTable {
        return new AnyTable(
            this.rows.filter(predicate),
            this.columnsAsArray.map((col) => col.spec),
            this,
            opName
        )
    }

    @computed get columnsByName() {
        const map = new Map<string, AbstractCoreColumn>()
        this._columns.forEach((col) => {
            map.set(col.name, col)
        })
        return map
    }

    @computed get columnSlugs() {
        return Array.from(this._columns.keys())
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
    }

    @action.bound selectAll() {
        this.selectRows(this.rows)
    }

    @action.bound deselectRows(rows: CoreRow[]) {
        rows.forEach((row) => {
            this.selectedRows.delete(row)
        })
    }

    @computed protected get unselectedRows() {
        return this.rows.filter((row) => !this.selectedRows.has(row))
    }

    @computed get hasSelection() {
        return this.selectedRows.size > 0
    }

    @action.bound clearSelection() {
        this.selectedRows.clear()
    }

    @computed get columnsAsArray() {
        return Array.from(this._columns.values())
    }

    extract(slugs = this.columnSlugs) {
        return this.rows.map((row) => slugs.map((slug) => row[slug] ?? ""))
    }

    toDebugInfo(showRows = 10): string {
        const rowCount = this.rows.length
        const showRowsClamped = showRows > rowCount ? rowCount : showRows
        const parentDebugInfo = this.parent
            ? this.parent.toDebugInfo(showRows) +
              `\n\n\n\n\n\n## ${this.tableDescription || ""}:\n\n`
            : "# Root Table:\n"
        const colTable = this.columnsAsArray.map((col) => {
            return {
                slug: col.slug,
                type: col.spec.type,
                name: col.name,
            }
        })
        return [
            parentDebugInfo,
            `${this.columnsAsArray.length} Columns. ${rowCount} Rows. ${showRowsClamped} shown below. \n`,
            toAlignedTextTable(["slug", "type", "name"], colTable) + "\n\n",
            toAlignedTextTable(
                this.columnSlugs,
                this.rows.slice(0, showRowsClamped)
            ),
        ].join("")
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
export declare type ObjectOfColumnSpecs = {
    [columnSlug: string]: CoreColumnSpec
}

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

// todo: remove
const rowTime = (row: CoreRow) =>
    parseInt(row.time ?? row.year ?? row.day ?? row.date)

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
        return this.table.rows.map((row) => row[slug])
    }

    // Rows containing a value for this column
    @computed get rowsWithValue() {
        const slug = this.spec.slug
        return this.table.rows.filter(
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
        return this.rowsWithValue.map((row, index) => {
            return {
                entityName: this.entityNames[index],
                time: this.times[index],
                value: this.parsedValues[index],
            }
        })
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

export class LoadingColumn extends AbstractCoreColumn {} // Todo: remove. A placeholder for now. Represents a column that has not loaded yet

class AnyColumn extends AbstractCoreColumn {}
class StringColumn extends AbstractCoreColumn {}

class CategoricalColumn extends AbstractCoreColumn {}
class BooleanColumn extends AbstractCoreColumn {}
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
        return this.rawValues.map((value) => parseFloat(value))
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
        return this.rawValues.map((value) => parseInt(value))
    }
}

abstract class TimeColumn extends AbstractCoreColumn {
    @computed get parsedValues() {
        return this.rawValues.map((value) => parseInt(value))
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
