import { TickFormattingOptions } from "grapher/core/GrapherConstants"
import {
    anyToString,
    csvEscape,
    formatValue,
    formatYear,
    formatDay,
    isString,
    last,
    sortBy,
    uniq,
    isPresent,
    sortNumeric,
    range,
    union,
} from "grapher/utils/Util"
import { CoreTable } from "./CoreTable"
import {
    CoreColumnDef,
    CoreRow,
    ColumnSlug,
    ColumnTypeNames,
    Time,
    PrimitiveType,
    JsTypes,
} from "./CoreTableConstants"
import { EntityName, OwidTableSlugs } from "coreTable/OwidTableConstants" // todo: remove. Should not be on CoreTable
import { InvalidCell, InvalidCellTypes } from "./InvalidCells"
import { LegacyVariableDisplayConfig } from "./LegacyVariableCode"
import { getOriginalTimeColumnSlug } from "./OwidTableUtil"
import { imemo } from "./CoreTableUtils"

interface ColumnSummary {
    numInvalidCells: number
    numUniqs: number
    numValues: number
}

interface ExtendedColumnSummary extends ColumnSummary {
    median: PrimitiveType
    sum: number
    mean: number
    min: PrimitiveType
    max: PrimitiveType
    range: number
    mode: PrimitiveType
    modeSize: number
    deciles: { [decile: number]: PrimitiveType }
}

abstract class AbstractCoreColumn<JS_TYPE extends PrimitiveType> {
    def: CoreColumnDef
    table: CoreTable

    constructor(table: CoreTable, def: CoreColumnDef) {
        this.table = table
        this.def = def
    }

    abstract jsType: JsTypes

    parse(val: any) {
        return val
    }

    @imemo get unit() {
        return this.def.unit || this.display?.unit || ""
    }

    @imemo protected get sortedValuesString() {
        return this.parsedValues.slice().sort()
    }

    @imemo protected get sortedValuesNumeric() {
        const numericCompare = (av: JS_TYPE, bv: JS_TYPE) =>
            av > bv ? 1 : av < bv ? -1 : 0
        return this.parsedValues.slice().sort(numericCompare)
    }

    @imemo get sortedValues() {
        return this.sortedValuesString
    }

    // todo: switch to a lib and/or add tests for this. handle non numerics better.
    @imemo get summary() {
        const { numInvalidCells, numValues, numUniqs } = this
        const basicSummary: ColumnSummary = {
            numInvalidCells,
            numUniqs,
            numValues,
        }
        if (!numValues) return basicSummary
        const summary: Partial<ExtendedColumnSummary> = { ...basicSummary }
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
            const value = arr[index] as any
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
        summary.sum = sum
        summary.median = arr[medianIndex]
        summary.mean = sum / numValues
        summary.min = min
        summary.max = max
        summary.range = (max as any) - (min as any)
        summary.mode = mode
        summary.modeSize = modeSize
        if (!isNumeric) {
            summary.sum = undefined
            summary.mean = undefined
        }

        summary.deciles = {}
        const deciles = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99, 100]
        deciles.forEach((decile) => {
            let index = Math.floor(numValues * (decile / 100))
            index = index === numValues ? index - 1 : index
            summary.deciles![decile] = arr[index]
        })

        return summary
    }

    // todo: migrate from unitConversionFactor to computed columns instead. then delete this.
    // note: unitConversionFactor is used >400 times in charts and >800 times in variables!!!
    @imemo get unitConversionFactor() {
        return this.display.conversionFactor ?? 1
    }

    @imemo get isAllIntegers() {
        return false
    }

    @imemo get tolerance() {
        return this.display.tolerance ?? 0
        // (this.property === "color" ? Infinity : 0) ... todo: figure out where color was being used
    }

    @imemo get domain() {
        return [this.minValue, this.maxValue]
    }

    @imemo get display() {
        return this.def.display || new LegacyVariableDisplayConfig()
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

    @imemo get numDecimalPlaces() {
        return this.display.numDecimalPlaces ?? 2
    }

    @imemo get shortUnit() {
        const shortUnit =
            this.display.shortUnit ?? this.def.shortUnit ?? undefined
        if (shortUnit !== undefined) return shortUnit

        const unit = this.display?.unit || this.def.unit || ""

        if (!unit) return ""

        if (unit.length < 3) return unit
        if (new Set(["$", "£", "€", "%"]).has(unit[0])) return unit[0]

        return ""
    }

    // A method for formatting for CSV
    formatForCsv(value: JS_TYPE) {
        return csvEscape(this.formatValue(value))
    }

    // Returns a map where the key is a series slug such as "name" and the value is a set
    // of all the unique values that this column has for that particular series.
    getUniqueValuesGroupedBy(indexColumnSlug: ColumnSlug) {
        const map = new Map<PrimitiveType, Set<PrimitiveType>>()
        const values = this.parsedValues
        const indexValues = this.table.getValuesAtIndices(
            indexColumnSlug,
            this.validRowIndices
        )
        indexValues.forEach((indexVal, index) => {
            if (!map.has(indexVal)) map.set(indexVal, new Set())
            map.get(indexVal)!.add(values[index])
        })
        return map
    }

    @imemo get description() {
        return this.def.description
    }

    @imemo get isEmpty() {
        return this.allValues.length === 0
    }

    @imemo get name() {
        return this.def.name ?? this.def.slug
    }

    @imemo get displayName() {
        return this.display?.name ?? this.name ?? ""
    }

    // todo: is the isString necessary?
    @imemo get sortedUniqNonEmptyStringVals() {
        return Array.from(
            new Set(this.parsedValues.filter(isString).filter((i) => i))
        ).sort()
    }

    @imemo get slug() {
        return this.def.slug
    }

    @imemo get valuesToIndices() {
        const map = new Map<any, number[]>()
        this.allValues.forEach((value, index) => {
            if (!map.has(value)) map.set(value, [])
            map.get(value)!.push(index)
        })
        return map
    }

    indicesWhere(value: JS_TYPE | JS_TYPE[]) {
        const queries = Array.isArray(value) ? value : [value]
        return union(
            ...queries
                .map((val) => this.valuesToIndices.get(val))
                .filter(isPresent)
        )
    }

    // We approximate whether a column is parsed simply by looking at the first row.
    needsParsing(value: any) {
        // Never parse computeds. The computed should return the correct JS type. Ideally we can provide some error messaging around this.
        if (this.def.fn || this.def.values) return false

        // If we already tried to parse it and failed we consider it "parsed"
        if (value instanceof InvalidCell) return false

        // If the passed value is of the correc type consider the column parsed.
        if (typeof value === this.jsType) return false
        return true
    }

    @imemo get isProjection() {
        return !!this.display?.isProjection
    }

    @imemo get uniqValues() {
        return uniq(this.parsedValues)
    }

    @imemo get allValues() {
        return this.table.getValuesFor(this.slug)
    }

    @imemo get validRowIndices() {
        return this.allValues
            .map((value, index) =>
                (value as any) instanceof InvalidCell ? null : index
            )
            .filter(isPresent)
    }

    @imemo get parsedValues() {
        const values = this.allValues
        return this.validRowIndices.map((index) => values[index]) as JS_TYPE[]
    }

    @imemo get originalTimes() {
        const originalTimeColumnSlug = getOriginalTimeColumnSlug(
            this.table,
            this.slug
        )
        if (!originalTimeColumnSlug) return []
        return this.table.getValuesAtIndices(
            originalTimeColumnSlug,
            this.validRowIndices
        ) as number[]
    }

    @imemo private get allValuesAsSet() {
        return new Set(this.allValues)
    }

    // True if the column has only 1 value. Looks at the (potentially) unparsed values.
    @imemo get isConstant() {
        return this.allValuesAsSet.size === 1
    }

    @imemo get minValue() {
        return this.valuesAscending[0]
    }

    @imemo get maxValue() {
        return last(this.valuesAscending)!
    }

    @imemo get numInvalidCells() {
        return this.allValues.length - this.numValues
    }

    // Number of correctly parsed values
    @imemo get numValues() {
        return this.parsedValues.length
    }

    @imemo get numUniqs() {
        return this.uniqValues.length
    }

    @imemo get valuesAscending() {
        return sortBy(this.parsedValues)
    }

    // todo: remove. should not be on coretable
    @imemo private get allTimes(): Time[] {
        return this.table.getTimesAtIndices(this.validRowIndices)
    }

    // todo: remove. should not be on coretable
    @imemo get uniqTimesAsc(): Time[] {
        return sortNumeric(uniq(this.allTimes))
    }

    // todo: remove. should not be on coretable
    @imemo get maxTime() {
        return last(this.uniqTimesAsc) as Time
    }

    // todo: remove. should not be on coretable
    @imemo get minTime(): Time {
        return this.uniqTimesAsc[0]
    }

    // todo: remove? Should not be on CoreTable
    @imemo get uniqEntityNames(): EntityName[] {
        return uniq(this.allEntityNames)
    }

    // todo: remove? Should not be on CoreTable
    @imemo private get allEntityNames() {
        return this.table.getValuesAtIndices(
            OwidTableSlugs.entityName,
            this.validRowIndices
        ) as EntityName[]
    }

    // todo: remove? Should not be on CoreTable
    @imemo get owidRows() {
        const times = this.originalTimes
        const values = this.parsedValues
        const entities = this.allEntityNames
        return range(0, times.length).map((index) => {
            return {
                entityName: entities[index],
                time: times[index],
                value: values[index],
            }
        })
    }

    // todo: remove? Should not be on CoreTable
    @imemo get owidRowsByEntityName() {
        const map = new Map<EntityName, CoreRow[]>()
        this.owidRows.forEach((row) => {
            if (!map.has(row.entityName)) map.set(row.entityName, [])
            map.get(row.entityName)!.push(row)
        })
        return map
    }

    // todo: remove? Should not be on CoreTable
    @imemo get valueByEntityNameAndTime() {
        const valueByEntityNameAndTime = new Map<
            EntityName,
            Map<Time, JS_TYPE>
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
}

export type CoreColumn = AbstractCoreColumn<any>

export class LoadingColumn extends AbstractCoreColumn<any> {
    jsType = JsTypes.string
} // Todo: remove. A placeholder for now. Represents a column that has not loaded yet

class StringColumn extends AbstractCoreColumn<string> {
    jsType = JsTypes.string

    parse(val: any) {
        if (val === null) return InvalidCellTypes.NullButShouldBeString
        if (val === undefined)
            return InvalidCellTypes.UndefinedButShouldBeString
        return val.toString() || ""
    }
}

class SeriesAnnotationColumn extends StringColumn {}
class CategoricalColumn extends StringColumn {}
class RegionColumn extends CategoricalColumn {}
class ContinentColumn extends RegionColumn {}
class ColorColumn extends CategoricalColumn {}
class BooleanColumn extends AbstractCoreColumn<boolean> {
    jsType = JsTypes.boolean

    parse(val: any) {
        return !!val
    }
}
abstract class AbstractNumericColumn extends AbstractCoreColumn<number> {
    jsType = JsTypes.number
    formatValueShort(value: number, options?: TickFormattingOptions) {
        const numDecimalPlaces = this.numDecimalPlaces
        return formatValue(value, {
            unit: this.shortUnit,
            numDecimalPlaces,
            ...options,
        })
    }

    @imemo get isAllIntegers() {
        return this.parsedValues.every((val) => val % 1 === 0)
    }

    @imemo get sortedValues() {
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
        if (val === null) return InvalidCellTypes.NullButShouldBeNumber
        if (val === undefined)
            return InvalidCellTypes.UndefinedButShouldBeNumber
        if (val === "") return InvalidCellTypes.BlankButShouldBeNumber
        if (isNaN(val)) return InvalidCellTypes.NaNButShouldBeNumber

        const res = this._parse(val)

        if (isNaN(res))
            return InvalidCellTypes.NotAParseableNumberButShouldBeNumber

        return res
    }

    protected _parse(val: any) {
        return parseFloat(val)
    }
}

class NumericColumn extends AbstractNumericColumn {}
class NumericCategoricalColumn extends AbstractNumericColumn {}

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

abstract class TimeColumn extends AbstractCoreColumn<number> {
    jsType = JsTypes.number

    parse(val: any) {
        return parseInt(val)
    }

    @imemo get sortedValues() {
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

    formatValueLong(value: number) {
        return formatValue(value, {
            numDecimalPlaces: 2,
            noTrailingZeroes: true,
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

// Expects 50% to be .5
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

// todo: remove. should not be in coretable
class EntityIdColumn extends NumericCategoricalColumn {}
class EntityCodeColumn extends CategoricalColumn {}
class EntityNameColumn extends CategoricalColumn {}

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
