import { TickFormattingOptions, Time } from "grapher/core/GrapherConstants"
import {
    anyToString,
    csvEscape,
    formatValue,
    formatYear,
    formatDay,
    isString,
    sortedUniq,
    last,
    sortBy,
} from "grapher/utils/Util"
import { computed } from "mobx"
import { CoreTable } from "./CoreTable"
import {
    CoreColumnSpec,
    CoreRow,
    ColumnSlug,
    EntityName,
    ColumnTypeNames,
    TimeTolerance,
} from "./CoreTableConstants"
import {
    InvalidCell,
    NullButShouldBeString,
    UndefinedButShouldBeString,
    NullButShouldBeNumber,
    UndefinedButShouldBeNumber,
    BlankButShouldBeNumber,
    NaNButShouldBeNumber,
    NotAParseableNumberButShouldBeNumber,
} from "./InvalidCells"
import { LegacyVariableDisplayConfig } from "./LegacyVariableCode"

// A measurement value. Example: For "A GDP of 200" the CellValue is 200.
type CellValue = number | string

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

// todo: remove
const rowTime = (row: CoreRow) =>
    parseInt(row.time ?? row.year ?? row.day ?? row.date)

abstract class AbstractCoreColumn {
    spec: CoreColumnSpec
    table: CoreTable<CoreRow>

    constructor(table: CoreTable<CoreRow>, spec: CoreColumnSpec) {
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
        return this.table.rows.filter((row) => row[slug] instanceof InvalidCell)
    }

    @computed get numParseErrors() {
        return this.rowsWithParseErrors.length
    }

    // Rows containing a value for this column
    @computed get rowsWithValue() {
        const slug = this.spec.slug
        return this.table.rows.filter(
            (row) => !(row[slug] instanceof InvalidCell)
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

export type CoreColumn = AbstractCoreColumn

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
class NumericColumn extends AbstractCoreColumn {
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

    parse(val: any): number | InvalidCell {
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

export const ColumnTypeMap: { [key in ColumnTypeNames]: any } = {
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
