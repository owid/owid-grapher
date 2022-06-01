import {
    anyToString,
    csvEscape,
    formatYear,
    formatDay,
    isString,
    last,
    uniq,
    sortNumeric,
    range,
    union,
    dateDiffInDays,
    isNumber,
    omitUndefinedValues,
} from "../clientUtils/Util.js"
import { isPresent } from "../clientUtils/isPresent.js"
import { CoreTable } from "./CoreTable.js"
import { Time, JsTypes, CoreValueType } from "./CoreTableConstants.js"
import { ColumnTypeNames, CoreColumnDef } from "./CoreColumnDef.js"
import { EntityName, OwidVariableRow } from "./OwidTableConstants.js" // todo: remove. Should not be on CoreTable
import { ErrorValue, ErrorValueTypes, isNotErrorValue } from "./ErrorValues.js"
import { getOriginalTimeColumnSlug } from "./OwidTableUtil.js"
import { imemo } from "./CoreTableUtils.js"
import dayjs from "../clientUtils/dayjs.js"
import { OwidSource } from "../clientUtils/OwidSource.js"
import {
    formatValue,
    checkIsVeryShortUnit,
    TickFormattingOptions,
} from "../clientUtils/formatValue.js"
import { OwidVariableDisplayConfigInterface } from "../clientUtils/OwidVariableDisplayConfigInterface.js"
import { ColumnSlug, PrimitiveType } from "../clientUtils/owidTypes.js"

interface ColumnSummary {
    numErrorValues: number
    numUniqs: number
    numValues: number
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

export abstract class AbstractCoreColumn<JS_TYPE extends PrimitiveType> {
    def: CoreColumnDef
    table: CoreTable

    constructor(table: CoreTable, def: CoreColumnDef) {
        this.table = table
        this.def = def
    }

    abstract jsType: JsTypes

    parse(val: any): any {
        return val
    }

    @imemo get isMissing(): boolean {
        return this instanceof MissingColumn
    }

    get sum(): number | undefined {
        return this.summary.sum
    }

    get median(): PrimitiveType | undefined {
        return this.summary.median
    }

    get max(): PrimitiveType | undefined {
        return this.summary.max
    }

    get min(): PrimitiveType | undefined {
        return this.summary.min
    }

    // todo: switch to a lib and/or add tests for this. handle non numerics better.
    @imemo get summary(): Partial<ColumnSummary> {
        const { numErrorValues, numValues, numUniqs } = this
        const basicSummary: Partial<ColumnSummary> = {
            numErrorValues,
            numUniqs,
            numValues,
        }
        if (!numValues) return basicSummary
        const summary: Partial<ColumnSummary> = { ...basicSummary }
        const arr = this.valuesAscending
        const isNumeric = this.jsType === "number"

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
    @imemo get unitConversionFactor(): number {
        return this.display?.conversionFactor ?? 1
    }

    @imemo get isAllIntegers(): boolean {
        return false
    }

    @imemo get tolerance(): number {
        return this.display?.tolerance ?? this.def.tolerance ?? 0
    }

    @imemo get domain(): [JS_TYPE, JS_TYPE] {
        return [this.minValue, this.maxValue]
    }

    @imemo get display(): OwidVariableDisplayConfigInterface | undefined {
        return this.def.display
    }

    abstract formatValue(value: any, options?: TickFormattingOptions): string

    formatValueForMobile(value: any, options?: TickFormattingOptions): string {
        return this.formatValue(value, options)
    }

    formatValueShortWithAbbreviations(
        value: any,
        options?: TickFormattingOptions
    ): string {
        return this.formatValue(value, options)
    }

    formatValueShort(value: any, options?: TickFormattingOptions): string {
        return this.formatValue(value, options)
    }

    formatValueLong(value: any, options?: TickFormattingOptions): string {
        return this.formatValue(value, options)
    }

    formatForTick(value: any, options?: TickFormattingOptions): string {
        return this.formatValueShort(value, options)
    }

    // A method for formatting for CSV
    formatForCsv(value: JS_TYPE): string {
        return csvEscape(anyToString(value))
    }

    @imemo get numDecimalPlaces(): number {
        return this.display?.numDecimalPlaces ?? 2
    }

    @imemo get unit(): string | undefined {
        return this.display?.unit ?? this.def.unit
    }

    @imemo get shortUnit(): string | undefined {
        const shortUnit =
            this.display?.shortUnit ?? this.def.shortUnit ?? undefined
        if (shortUnit !== undefined) return shortUnit

        const unit = this.unit

        if (!unit) return undefined

        if (unit.length < 3) return unit
        if (new Set(["$", "£", "€", "%"]).has(unit[0])) return unit[0]

        return undefined
    }

    // Returns a map where the key is a series slug such as "name" and the value is a set
    // of all the unique values that this column has for that particular series.
    getUniqueValuesGroupedBy(
        indexColumnSlug: ColumnSlug
    ): Map<PrimitiveType, Set<PrimitiveType>> {
        const map = new Map<PrimitiveType, Set<PrimitiveType>>()
        const values = this.values
        const indexValues = this.table.getValuesAtIndices(
            indexColumnSlug,
            this.validRowIndices
        ) as PrimitiveType[]
        indexValues.forEach((indexVal, index) => {
            if (!map.has(indexVal)) map.set(indexVal, new Set())
            map.get(indexVal)!.add(values[index])
        })
        return map
    }

    @imemo get description(): string | undefined {
        return this.def.description
    }

    @imemo get isEmpty(): boolean {
        return this.valuesIncludingErrorValues.length === 0
    }

    @imemo get name(): string {
        return this.def.name ?? this.def.slug
    }

    @imemo get displayName(): string {
        return this.display?.name ?? this.name ?? ""
    }

    // todo: is the isString necessary?
    @imemo get sortedUniqNonEmptyStringVals(): JS_TYPE[] {
        return Array.from(
            new Set(this.values.filter(isString).filter((i) => i))
        ).sort()
    }

    @imemo get slug(): string {
        return this.def.slug
    }

    @imemo get valuesToIndices(): Map<any, number[]> {
        const map = new Map<any, number[]>()
        this.valuesIncludingErrorValues.forEach((value, index) => {
            if (!map.has(value)) map.set(value, [])
            map.get(value)!.push(index)
        })
        return map
    }

    indicesWhere(value: JS_TYPE | JS_TYPE[]): any {
        const queries = Array.isArray(value) ? value : [value]
        return union(
            ...queries
                .map((val) => this.valuesToIndices.get(val))
                .filter(isPresent)
        )
    }

    // We approximate whether a column is parsed simply by looking at the first row.
    needsParsing(value: any): boolean {
        // Skip parsing if explicit flag is set
        if (this.def.skipParsing) return false

        // Never parse computeds. The computed should return the correct JS type. Ideally we can provide some error messaging around this.
        if (this.def.transform) return false

        // If we already tried to parse it and failed we consider it "parsed"
        if (value instanceof ErrorValue) return false

        // If the passed value is of the correct type consider the column parsed.
        if (typeof value === this.jsType) return false
        return true
    }

    @imemo get isProjection(): boolean {
        return !!this.display?.isProjection
    }

    @imemo get uniqValues(): JS_TYPE[] {
        return uniq(this.values)
    }

    @imemo get uniqValuesAsSet(): Set<JS_TYPE> {
        return new Set(this.uniqValues)
    }

    /**
     * Returns all values including ErrorValues..
     * Normally you want just the valid values, like `[45000, 50000, ...]`. But sometimes you
     * need the ErrorValues too like `[45000, DivideByZeroError, 50000,...]`
     */
    @imemo get valuesIncludingErrorValues(): CoreValueType[] {
        const { table, slug } = this
        return table.has(slug) ? table.columnStore[slug] : []
    }

    @imemo get validRowIndices(): number[] {
        return this.valuesIncludingErrorValues
            .map((value, index) => (isNotErrorValue(value) ? index : undefined))
            .filter(isPresent)
    }

    @imemo get values(): JS_TYPE[] {
        const values = this.valuesIncludingErrorValues
        return this.validRowIndices.map((index) => values[index]) as JS_TYPE[]
    }

    @imemo get originalTimeColumnSlug(): string {
        return getOriginalTimeColumnSlug(this.table, this.slug)
    }

    @imemo get originalTimeColumn(): CoreColumn {
        return this.table.get(this.originalTimeColumnSlug)
    }

    @imemo get originalTimes(): number[] {
        const { originalTimeColumnSlug } = this
        if (!originalTimeColumnSlug) return []
        return this.table.getValuesAtIndices(
            originalTimeColumnSlug,
            this.validRowIndices
        ) as number[]
    }

    /**
     * True if the column has only 1 unique value. ErrorValues are counted as values, so
     * something like [DivideByZeroError, 2, 2] would not be constant.
     */
    @imemo get isConstant(): boolean {
        return new Set(this.valuesIncludingErrorValues).size === 1
    }

    @imemo get minValue(): JS_TYPE {
        return this.valuesAscending[0]
    }

    @imemo get maxValue(): JS_TYPE {
        return last(this.valuesAscending)!
    }

    @imemo get numErrorValues(): number {
        return this.valuesIncludingErrorValues.length - this.numValues
    }

    // Number of correctly parsed values
    @imemo get numValues(): number {
        return this.values.length
    }

    @imemo get numUniqs(): number {
        return this.uniqValues.length
    }

    @imemo get valuesAscending(): JS_TYPE[] {
        const values = this.values.slice()
        return this.jsType === "string" ? values.sort() : sortNumeric(values)
    }

    get source(): OwidSource {
        const { def } = this
        return {
            name: def.sourceName,
            link: def.sourceLink,
            dataPublishedBy: def.dataPublishedBy,
            dataPublisherSource: def.dataPublisherSource,
            retrievedDate: def.retrievedDate,
            additionalInfo: def.additionalInfo,
        }
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
    @imemo get maxTime(): Time {
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
    @imemo private get allEntityNames(): EntityName[] {
        return this.table.getValuesAtIndices(
            this.table.entityNameSlug,
            this.validRowIndices
        ) as EntityName[]
    }

    // todo: remove? Should not be on CoreTable
    // assumes table is sorted by time
    @imemo get owidRows(): OwidVariableRow<JS_TYPE>[] {
        const times = this.originalTimes
        const values = this.values
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
    @imemo get owidRowsByEntityName(): Map<
        EntityName,
        OwidVariableRow<JS_TYPE>[]
    > {
        const map = new Map<EntityName, OwidVariableRow<JS_TYPE>[]>()
        this.owidRows.forEach((row) => {
            if (!map.has(row.entityName)) map.set(row.entityName, [])
            map.get(row.entityName)!.push(row)
        })
        return map
    }

    // todo: remove? Should not be on CoreTable
    // NOTE: this uses the original times, so any tolerance is effectively unapplied.
    @imemo get valueByEntityNameAndOriginalTime(): Map<
        EntityName,
        Map<Time, JS_TYPE>
    > {
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

export class MissingColumn extends AbstractCoreColumn<any> {
    jsType = JsTypes.string

    formatValue(): string {
        return ""
    }
}

class StringColumn extends AbstractCoreColumn<string> {
    jsType = JsTypes.string

    formatValue(value: any): string {
        return anyToString(value)
    }

    parse(val: any): any {
        if (val === null) return ErrorValueTypes.NullButShouldBeString
        if (val === undefined) return ErrorValueTypes.UndefinedButShouldBeString
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

    formatValue(value: any): "true" | "false" {
        return value ? "true" : "false"
    }

    parse(val: any): boolean {
        return !!val
    }
}

abstract class AbstractNumericColumn<
    T extends PrimitiveType = number
> extends AbstractCoreColumn<T> {
    jsType = JsTypes.number

    formatValue(value: number, options?: TickFormattingOptions): string {
        if (isNumber(value)) {
            return formatValue(value, {
                numDecimalPlaces: this.numDecimalPlaces,
                ...options,
            })
        }
        return ""
    }

    formatValueShortWithAbbreviations(
        value: number,
        options?: TickFormattingOptions
    ): string {
        return super.formatValueShortWithAbbreviations(value, {
            numberAbbreviation: "short",
            // only include a unit if it's very short (e.g. %, $ or £)
            ...omitUndefinedValues({
                unit:
                    this.shortUnit !== undefined &&
                    checkIsVeryShortUnit(this.shortUnit)
                        ? this.shortUnit
                        : undefined,
            }),
            ...options,
        })
    }

    formatValueShort(value: number, options?: TickFormattingOptions): string {
        return super.formatValueShort(value, {
            ...omitUndefinedValues({
                unit: this.shortUnit,
            }),
            ...options,
        })
    }

    formatValueLong(value: number, options?: TickFormattingOptions): string {
        return super.formatValueLong(value, {
            ...omitUndefinedValues({
                unit: this.unit,
            }),
            ...options,
        })
    }

    @imemo get isAllIntegers(): boolean {
        return this.values.every(
            (val) => typeof val === "number" && val % 1 === 0
        )
    }

    parse(val: any): number | T | ErrorValue {
        if (val === null) return ErrorValueTypes.NullButShouldBeNumber
        if (val === undefined) return ErrorValueTypes.UndefinedButShouldBeNumber
        if (val === "") return ErrorValueTypes.BlankButShouldBeNumber
        if (isNaN(val)) return ErrorValueTypes.NaNButShouldBeNumber

        const res = this._parse(val)

        if (isNaN(res))
            return ErrorValueTypes.NotAParseableNumberButShouldBeNumber

        return res
    }

    protected _parse(val: any): number {
        return parseFloat(val)
    }
}

/**
 * We strive to have clearly typed variables in the future, but for now our
 * grapher variables are still untyped. Most are number-only, but we also have some
 * string-only, and even some mixed ones.
 * Hence, NumberOrStringColumn is used to store grapher variables.
 * It is not ideal that it extends AbstractNumericColumn, but that ensures that we
 * have implementations of formatValueShortWithAbbreviations and the like already.
 * -- @marcelgerber, 2022-07-01
 */
class NumberOrStringColumn extends AbstractNumericColumn<number | string> {
    formatValue(value: any, options?: TickFormattingOptions): string {
        if (isNumber(value)) {
            return super.formatValue(value, options)
        }
        return anyToString(value)
    }

    parse(val: any): number | string | ErrorValue {
        if (val === null) return ErrorValueTypes.NullButShouldBeNumber
        if (val === undefined) return ErrorValueTypes.UndefinedButShouldBeNumber
        if (Number.isNaN(val)) return ErrorValueTypes.NaNButShouldBeNumber

        const num = parseFloat(val)

        if (Number.isNaN(num)) return val

        return num
    }
}

class NumericColumn extends AbstractNumericColumn {}
class NumericCategoricalColumn extends AbstractNumericColumn {}

class IntegerColumn extends NumericColumn {
    formatValue(value: any, options?: TickFormattingOptions): string {
        return super.formatValue(value, {
            numDecimalPlaces: 0,
            ...options,
        })
    }

    protected _parse(val: any): number {
        return parseInt(val)
    }
}

class CurrencyColumn extends NumericColumn {
    formatValue(value: any, options?: TickFormattingOptions): string {
        return super.formatValue(value, {
            numDecimalPlaces: 0,
            unit: "$",
            ...options,
        })
    }
}
// Expects 50% to be 50
class PercentageColumn extends NumericColumn {
    formatValue(value: number, options?: TickFormattingOptions): string {
        return super.formatValue(value, {
            unit: "%",
            ...options,
        })
    }
}

// Same as %, but indicates it's part of a group of columns that add up to 100%.
// Might not need this.
class RelativePercentageColumn extends PercentageColumn {}

class PercentChangeOverTimeColumn extends PercentageColumn {
    formatValue(value: number, options?: TickFormattingOptions): string {
        return super.formatValue(value, {
            showPlus: true,
            ...options,
        })
    }
}

class DecimalPercentageColumn extends PercentageColumn {}
class RatioColumn extends NumericColumn {}

// todo: remove. should not be in coretable
class EntityIdColumn extends NumericCategoricalColumn {}
class EntityCodeColumn extends CategoricalColumn {}
class EntityNameColumn extends CategoricalColumn {}

// todo: cleanup time columns. current schema is a little incorrect.
export abstract class TimeColumn extends AbstractCoreColumn<number> {
    jsType = JsTypes.number

    abstract preposition: string

    parse(val: any): number | ErrorValue {
        return parseInt(val)
    }
}

class YearColumn extends TimeColumn {
    preposition = "in"

    formatValue(value: number): string {
        // Include BCE
        return formatYear(value)
    }
}

class DayColumn extends TimeColumn {
    preposition = "on"

    formatValue(value: number): string {
        return formatDay(value)
    }

    formatValueForMobile(value: number): string {
        return formatDay(value, { format: "MMM D, 'YY" })
    }

    formatForCsv(value: number): string {
        return formatDay(value, { format: "YYYY-MM-DD" })
    }
}

const dateToTimeCache = new Map<string, Time>() // Cache for performance
class DateColumn extends DayColumn {
    parse(val: any): number {
        // skip parsing if a date is a number, it's already been parsed
        if (typeof val === "number") return val
        if (!dateToTimeCache.has(val))
            dateToTimeCache.set(
                val,
                dateDiffInDays(
                    dayjs.utc(val).toDate(),
                    dayjs.utc("2020-01-21").toDate()
                )
            )
        return dateToTimeCache.get(val)!
    }
}

class QuarterColumn extends TimeColumn {
    preposition = "in"

    private static regEx = /^([+-]?\d+)-Q([1-4])$/

    parse(val: any): number | ErrorValue {
        // skip parsing if a date is a number, it's already been parsed
        if (typeof val === "number") return val
        if (typeof val === "string") {
            const match = val.match(QuarterColumn.regEx)
            if (match) {
                const [, year, quarter] = match
                return parseInt(year) * 4 + (parseInt(quarter) - 1)
            }
        }
        return ErrorValueTypes.InvalidQuarterValue
    }

    private static numToQuarter(value: number): number[] {
        const year = Math.floor(value / 4)
        const quarter = (Math.abs(value) % 4) + 1
        return [year, quarter]
    }

    formatValue(value: number): string {
        const [year, quarter] = QuarterColumn.numToQuarter(value)
        return `Q${quarter}/${year}`
    }

    formatForCsv(value: number): string {
        const [year, quarter] = QuarterColumn.numToQuarter(value)
        return `${year}-Q${quarter}`
    }
}

class PopulationColumn extends IntegerColumn {}
class PopulationDensityColumn extends NumericColumn {}

class AgeColumn extends NumericColumn {}

export const ColumnTypeMap = {
    String: StringColumn,
    SeriesAnnotation: SeriesAnnotationColumn,
    Categorical: CategoricalColumn,
    Region: RegionColumn,
    Continent: ContinentColumn,
    NumberOrString: NumberOrStringColumn,
    Numeric: NumericColumn,
    Day: DayColumn,
    Date: DateColumn,
    Year: YearColumn,
    Quarter: QuarterColumn,
    Time: TimeColumn,
    Boolean: BooleanColumn,
    Currency: CurrencyColumn,
    Percentage: PercentageColumn,
    RelativePercentage: RelativePercentageColumn,
    Integer: IntegerColumn,
    DecimalPercentage: DecimalPercentageColumn,
    PercentChangeOverTime: PercentChangeOverTimeColumn,
    Ratio: RatioColumn,
    Color: ColorColumn,
    EntityCode: EntityCodeColumn,
    EntityId: EntityIdColumn,
    EntityName: EntityNameColumn,
    Population: PopulationColumn,
    PopulationDensity: PopulationDensityColumn,
    Age: AgeColumn,
}

// Keep this in. This is used as a compile-time check that ColumnTypeMap covers all
// column names defined in ColumnTypeNames, since that is quite difficult to ensure
// otherwise without losing inferred type information.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ColumnTypeMap: {
    [key in ColumnTypeNames]: unknown
} = ColumnTypeMap
