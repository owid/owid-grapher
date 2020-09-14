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
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { EPOCH_DATE } from "grapher/core/GrapherConstants"
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

enum OwidRequiredColumns {
    entityName = "entityName",
    entityCode = "entityCode",
    entityId = "entityId",
}

// This is a row with the additional columns specific to our OWID data model
interface OwidRow extends Row {
    entityName: EntityName
    entityCode: EntityCode
    entityId: EntityId
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
        return this.spec.unit || ""
    }

    @computed get shortUnit() {
        return this.spec.shortUnit || ""
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

    formatValue(value: any): string {
        return anyToString(value)
    }

    formatValueForMobile(value: any): string {
        return this.formatValue(value)
    }

    formatValueShort(value: any) {
        return this.formatValue(value)
    }

    // A method for formatting for CSV
    formatForCsv(value: any): string {
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

    // todo: is the isString necessary?
    @computed get sortedUniqNonEmptyStringVals(): string[] {
        return Array.from(
            new Set(this.values.filter(isString).filter((i) => i))
        ).sort()
    }

    @computed get slug() {
        return this.spec.slug
    }

    // todo: remove
    @computed get entityNames() {
        return this.rowsWithValue.map((row) => row.entityName)
    }

    // todo: remove
    @computed get entityNamesUniq() {
        return new Set<string>(this.entityNames)
    }

    // todo: remove
    @computed get valuesUniq(): any[] {
        return Array.from(this.valuesAsSet)
    }

    @computed private get valuesAsSet() {
        return new Set(this.values)
    }

    @computed private get allValuesAsSet() {
        return new Set(this.allValues)
    }

    // True if the column has only 1 value
    @computed get isConstant() {
        return this.allValuesAsSet.size === 1
    }

    // todo: remove
    @computed get times() {
        return this.rowsWithValue.map((row) => (row.year ?? row.day)!)
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

    @computed get values() {
        const slug = this.spec.slug
        return this.rowsWithValue.map((row) => row[slug])
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
abstract class TemporalColumn extends AbstractColumn {}

class YearColumn extends TemporalColumn {
    formatValue(value: number) {
        // Include BCE
        return formatYear(value)
    }

    formatForCsv(value: number) {
        // Don't include BCE in CSV exports.
        return anyToString(value)
    }
}

class DateColumn extends TemporalColumn {
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

class CategoricalColumn extends AbstractColumn {}
class BooleanColumn extends AbstractColumn {}
class FilterColumn extends BooleanColumn {}
class SelectionColumn extends BooleanColumn {}
export class NumericColumn extends AbstractColumn {
    formatValueShort(value: any) {
        const numDecimalPlaces = this.display.numDecimalPlaces
        return formatValue(value, {
            unit: this.shortUnit,
            numDecimalPlaces,
        })
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
    @action.bound load(
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

    @computed get timeColumn() {
        const col = this.columnsAsArray.find(
            (col) => col instanceof TemporalColumn
        )
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
        columnSpecs: ColumnSpecs | ColumnSpecObject | ColumnSpec[]
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
            if (!cols.has(slug)) cols.set(slug, new columnType(this, spec))
        })
    }

    static makeSpecsFromRows(rows: any[]): ColumnSpecs {
        const map = new Map()
        // Todo: type detection
        rows.forEach((row) => {
            Object.keys(row).forEach((key) => {
                map.set(key, { slug: key })
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

    toDelimited(slugs = this.columnSlugs, rowLimit?: number, delimiter = ",") {
        const header = slugs.join(delimiter) + "\n"
        const body = this.extract(slugs)
            .slice(0, rowLimit)
            .map((row) => row.join(delimiter))
            .join("\n")
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

export class OwidTable extends AbstractTable<OwidRow> {
    static fromDelimited(csvOrTsv: string) {
        const parsed = parseDelimited(csvOrTsv)
        const colSlugs = parsed[0] ? Object.keys(parsed[0]) : []
        const missingColumns: string[] = []
        Object.keys(OwidRequiredColumns).forEach((slug) => {
            if (!colSlugs.includes(slug)) missingColumns.push(slug)
        })
        if (missingColumns.length)
            throw new Error(
                `Table is missing required OWID columns: '${missingColumns.join(
                    ","
                )}'`
            )

        return new OwidTable((parsed as any) as OwidRow[])
    }

    @computed get columnsByOwidVarId() {
        const map = new Map<number, AbstractColumn>()
        Array.from(this.columns.values()).forEach((column, index) => {
            map.set(column.spec.owidVariableId ?? index, column)
        })
        return map
    }

    @computed get availableEntities() {
        return Array.from(this.availableEntitiesSet)
    }

    @computed get availableEntitiesSet() {
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

    // Clears and sets selected entities
    @action.bound setSelectedEntities(entityNames: EntityName[]) {
        this.initDefaultEntitySelectionColumn()
        const set = new Set(entityNames)
        this.rows.forEach((row) => {
            row[this.defaultEntitySelectionSlug] = set.has(row.entityName)
        })
        return this
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

    @action.bound loadFromLegacy(json: LegacyVariablesAndEntityKey) {
        let rows: OwidRow[] = []
        const entityMetaById: { [id: string]: LegacyEntityMeta } =
            json.entityKey
        const columnSpecs: Map<ColumnSlug, ColumnSpec> = new Map()
        columnSpecs.set("entityName", {
            name: "Entity",
            slug: "entityName",
            type: ColumnTypeNames.Categorical,
        })
        columnSpecs.set("entityId", {
            slug: "entityId",
            type: ColumnTypeNames.Categorical,
        })
        columnSpecs.set("entityCode", {
            name: "Code",
            slug: "entityCode",
            type: ColumnTypeNames.Categorical,
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
                const row: any = {
                    [timeColumnName]: years[index],
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

        const sorted = sortBy(joinedRows, ["year", "day"])
        return this.load(sorted, columnSpecs, false)
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
