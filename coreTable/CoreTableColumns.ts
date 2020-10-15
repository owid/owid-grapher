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
    unionOfSets,
    sortNumeric,
} from "grapher/utils/Util"
import { computed } from "mobx"
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
import { EntityName } from "coreTable/OwidTableConstants" // todo: remove. Should not be on CoreTable
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

interface ColumnSummary {
    numParseErrors: number
    uniqueValues: number
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

// todo: remove
const rowTime = (row: CoreRow) =>
    parseInt(row.time ?? row.year ?? row.day ?? row.date)

abstract class AbstractCoreColumn<JS_TYPE extends PrimitiveType> {
    def: CoreColumnDef
    table: CoreTable

    constructor(table: CoreTable, def: CoreColumnDef) {
        this.table = table
        this.def = def
    }

    abstract jsType: JsTypes
    isParsed(val: any) {
        if (val instanceof InvalidCell) return true // If we already tried to parse it consider it "parsed"
        return typeof val === this.jsType
    }

    parse(val: any) {
        return val
    }

    @computed get unit() {
        return this.def.unit || this.display?.unit || ""
    }

    @computed protected get sortedValuesString() {
        return this.parsedValues.slice().sort()
    }

    @computed protected get sortedValuesNumeric() {
        const numericCompare = (av: JS_TYPE, bv: JS_TYPE) =>
            av > bv ? 1 : av < bv ? -1 : 0
        return this.parsedValues.slice().sort(numericCompare)
    }

    @computed get sortedValues() {
        return this.sortedValuesString
    }

    // todo: switch to a lib and/or add tests for this. handle non numerics better.
    @computed get summary() {
        const { numParseErrors, numValues } = this
        const basicSummary: ColumnSummary = {
            numParseErrors,
            uniqueValues: this.uniqValues.length,
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
    @computed get unitConversionFactor() {
        return this.display.conversionFactor ?? 1
    }

    @computed get isAllIntegers() {
        return false
    }

    @computed get tolerance() {
        return this.display.tolerance ?? 0
        // (this.property === "color" ? Infinity : 0) ... todo: figure out where color was being used
    }

    @computed get domain() {
        return [this.minValue, this.maxValue]
    }

    @computed get display() {
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

    @computed get numDecimalPlaces() {
        return this.display.numDecimalPlaces ?? 2
    }

    @computed get shortUnit() {
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
        const map = new Map<ColumnSlug, Set<PrimitiveType>>()
        const slug = this.slug
        this.validRows.forEach((row) => {
            const thisValue = row[slug]
            // For now the behavior is to not overwrite an existing value with an empty one
            if (thisValue === "" || thisValue instanceof InvalidCell) return

            const indexVal = row[indexColumnSlug]
            if (!map.has(indexVal)) !map.set(indexVal, new Set())

            map.get(indexVal)!.add(thisValue)
        })

        return map
    }

    @computed get description() {
        return this.def.description
    }

    @computed get isEmpty() {
        return this.validRows.length === 0
    }

    @computed get name() {
        return this.def.name ?? this.def.slug
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
        return this.def.slug
    }

    // An index on rows
    @computed get valuesToRows() {
        const map = new Map<JS_TYPE, Set<CoreRow>>()
        const slug = this.slug
        this.validRows.forEach((row) => {
            if (!map.has(row[slug])) map.set(row[slug], new Set<CoreRow>())
            map.get(row[slug])!.add(row)
        })
        return map
    }

    rowsWhere(value: JS_TYPE | JS_TYPE[]) {
        const queries = Array.isArray(value) ? value : [value]
        return unionOfSets(
            queries.map((val) => this.valuesToRows.get(val)).filter(isPresent)
        )
    }

    @computed get isProjection() {
        return !!this.display?.isProjection
    }

    @computed get uniqValues() {
        return uniq(this.parsedValues)
    }

    @computed private get allValues() {
        const slug = this.slug
        return this.table.rows.map((row) => row[slug])
    }

    @computed private get allValuesAsSet() {
        return new Set(this.allValues)
    }

    // True if the column has only 1 value. Looks at the (potentially) unparsed values.
    @computed get isConstant() {
        return this.allValuesAsSet.size === 1
    }

    @computed get minValue() {
        return this.valuesAscending[0]
    }

    @computed get maxValue() {
        return last(this.valuesAscending)!
    }

    @computed private get rowsWithParseErrors() {
        const slug = this.def.slug
        return this.table.rows.filter((row) => row[slug] instanceof InvalidCell)
    }

    @computed get numParseErrors() {
        return this.rowsWithParseErrors.length
    }

    // Rows containing a value for this column
    @computed get validRows() {
        const slug = this.def.slug
        return this.table.rows.filter(
            (row) => !(row[slug] instanceof InvalidCell)
        )
    }

    // Number of correctly parsed values
    @computed get numValues() {
        return this.validRows.length
    }

    @computed get parsedValues(): JS_TYPE[] {
        const slug = this.def.slug
        return this.validRows.map((row) => row[slug])
    }

    @computed get valuesAscending() {
        return sortBy(this.parsedValues)
    }

    // todo: remove. should not be on coretable
    @computed private get allTimes(): Time[] {
        return this.validRows.map((row) => rowTime(row))
    }

    // todo: remove. should not be on coretable
    @computed get uniqTimesAsc(): Time[] {
        return sortNumeric(uniq(this.allTimes))
    }

    // todo: remove. should not be on coretable
    @computed get maxTime() {
        return last(this.uniqTimesAsc) as Time
    }

    // todo: remove. should not be on coretable
    @computed get minTime(): Time {
        return this.uniqTimesAsc[0]
    }

    // todo: remove? Should not be on CoreTable
    @computed get uniqEntityNames(): EntityName[] {
        return uniq(this.validRows.map((row) => row.entityName))
    }

    // todo: remove? Should not be on CoreTable
    @computed get owidRows() {
        const times = this.allTimes
        return this.validRows.map((row, index) => {
            return {
                entityName: row.entityName,
                time: times[index],
                value: this.parsedValues[index],
            }
        })
    }

    // todo: remove? Should not be on CoreTable
    @computed get owidRowsByEntityName() {
        const map = new Map<EntityName, CoreRow[]>()
        this.owidRows.forEach((row) => {
            if (!map.has(row.entityName)) map.set(row.entityName, [])
            map.get(row.entityName)!.push(row)
        })
        return map
    }

    // todo: remove? Should not be on CoreTable
    @computed get valueByEntityNameAndTime() {
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
        if (val === null) return new NullButShouldBeString()
        if (val === undefined) return new UndefinedButShouldBeString()
        return val.toString() || ""
    }
}

class SeriesAnnotationColumn extends StringColumn {}

class NumericCategoricalColumn extends AbstractCoreColumn<number> {
    jsType = JsTypes.number
}

class CategoricalColumn extends AbstractCoreColumn<string> {
    jsType = JsTypes.string
}
class RegionColumn extends CategoricalColumn {}
class ContinentColumn extends RegionColumn {}
class ColorColumn extends CategoricalColumn {}
class BooleanColumn extends AbstractCoreColumn<boolean> {
    jsType = JsTypes.boolean

    parse(val: any) {
        return !!val
    }
}
class NumericColumn extends AbstractCoreColumn<number> {
    jsType = JsTypes.number
    formatValueShort(value: number, options?: TickFormattingOptions) {
        const numDecimalPlaces = this.numDecimalPlaces
        return formatValue(value, {
            unit: this.shortUnit,
            numDecimalPlaces,
            ...options,
        })
    }

    @computed get isAllIntegers() {
        return this.parsedValues.every((val) => val % 1 === 0)
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

abstract class TimeColumn extends AbstractCoreColumn<number> {
    jsType = JsTypes.number

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
