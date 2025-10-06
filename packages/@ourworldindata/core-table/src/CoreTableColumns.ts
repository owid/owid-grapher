import * as _ from "lodash-es"
import {
    anyToString,
    csvEscape,
    formatYear,
    formatDay,
    sortNumeric,
    dateDiffInDays,
    omitUndefinedValues,
    isPresent,
    dayjs,
    OwidSource,
    formatValue,
    checkIsVeryShortUnit,
    TickFormattingOptions,
    OwidVariableDisplayConfigInterface,
    ColumnSlug,
    PrimitiveType,
    imemo,
    ToleranceStrategy,
    IndicatorTitleWithFragments,
} from "@ourworldindata/utils"
import { CoreTable } from "./CoreTable.js"
import {
    Time,
    JsTypes,
    CoreValueType,
    ColumnTypeNames,
    CoreColumnDef,
    EntityName,
    OwidVariableRow,
    ErrorValue,
    OwidVariableRoundingMode,
} from "@ourworldindata/types"
import { ErrorValueTypes, isNotErrorValue } from "./ErrorValues.js"
import {
    getOriginalTimeColumnSlug,
    getOriginalValueColumnSlug,
} from "./OwidTableUtil.js"
import * as R from "remeda"

export abstract class AbstractCoreColumn<JS_TYPE extends PrimitiveType> {
    def: CoreColumnDef
    table: CoreTable

    constructor(table: CoreTable, def: CoreColumnDef) {
        this.table = table
        this.def = def
    }

    abstract jsType: JsTypes

    parse(val: unknown): any {
        return val
    }

    @imemo get isMissing(): boolean {
        return this instanceof MissingColumn
    }

    @imemo get hasNumberFormatting(): boolean {
        return this instanceof AbstractColumnWithNumberFormatting
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

    @imemo get toleranceStrategy(): ToleranceStrategy | undefined {
        return this.def.toleranceStrategy
    }

    @imemo get display(): OwidVariableDisplayConfigInterface | undefined {
        return this.def.display
    }

    abstract formatValue(
        value: unknown,
        options?: TickFormattingOptions
    ): string

    formatValueForMobile(
        value: unknown,
        options?: TickFormattingOptions
    ): string {
        return this.formatValue(value, options)
    }

    formatValueShortWithAbbreviations(
        value: unknown,
        options?: TickFormattingOptions
    ): string {
        return this.formatValue(value, options)
    }

    formatValueShort(value: unknown, options?: TickFormattingOptions): string {
        return this.formatValue(value, options)
    }

    formatValueLong(value: unknown, options?: TickFormattingOptions): string {
        return this.formatValue(value, options)
    }

    formatForTick(value: unknown, options?: TickFormattingOptions): string {
        return this.formatValueShort(value, options)
    }

    // A method for formatting for CSV
    formatForCsv(value: JS_TYPE): string {
        return csvEscape(anyToString(value))
    }

    formatTime(time: number): string {
        return this.originalTimeColumn.formatValue(time)
    }

    @imemo get roundingMode(): OwidVariableRoundingMode {
        return (
            this.display?.roundingMode ?? OwidVariableRoundingMode.decimalPlaces
        )
    }

    @imemo get roundsToFixedDecimals(): boolean {
        return this.roundingMode === OwidVariableRoundingMode.decimalPlaces
    }

    @imemo get roundsToSignificantFigures(): boolean {
        return this.roundingMode === OwidVariableRoundingMode.significantFigures
    }

    @imemo get numDecimalPlaces(): number {
        return this.display?.numDecimalPlaces ?? 2
    }

    @imemo get numSignificantFigures(): number {
        return this.display?.numSignificantFigures ?? 3
    }

    @imemo get unit(): string | undefined {
        const unit = this.display?.unit ?? this.def.unit
        return unit?.trim()
    }

    @imemo get shortUnit(): string | undefined {
        const shortUnit =
            this.display?.shortUnit ?? this.def.shortUnit ?? undefined
        if (shortUnit !== undefined) return shortUnit

        const unit = this.unit

        if (!unit) return undefined

        if (unit.length < 3) return unit
        if (checkIsVeryShortUnit(unit[0])) return unit[0]

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

    @imemo get nonEmptyName(): string {
        return this.def.name || this.def.slug
    }

    @imemo get displayName(): string {
        return (
            this.display?.name ??
            // this is a bit of an unusual fallback - if display.name is not given, titlePublic is the next best thing before name
            this.def.presentation?.titlePublic ??
            this.name ??
            ""
        )
    }

    @imemo get nonEmptyDisplayName(): string {
        return (
            this.display?.name ||
            // this is a bit of an unusual fallback - if display.name is not given, titlePublic is the next best thing before name
            this.def.presentation?.titlePublic ||
            this.nonEmptyName
        )
    }

    @imemo get titlePublicOrDisplayName(): IndicatorTitleWithFragments {
        return this.def.presentation?.titlePublic
            ? {
                  title: this.def.presentation?.titlePublic,
                  attributionShort: this.def.presentation?.attributionShort,
                  titleVariant: this.def.presentation?.titleVariant,
              }
            : { title: this.display?.name || this.name || "" }
    }

    @imemo get datasetId(): number | undefined {
        return this.def.datasetId
    }

    @imemo get datasetName(): string | undefined {
        return this.def.datasetName
    }

    // todo: is the isString necessary?
    @imemo get sortedUniqNonEmptyStringVals(): JS_TYPE[] {
        return Array.from(
            new Set(this.values.filter(R.isString).filter((i) => i))
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
        return _.union(
            ...queries
                .map((val) => this.valuesToIndices.get(val))
                .filter(isPresent)
        )
    }

    // We approximate whether a column is parsed simply by looking at the first row.
    needsParsing(value: unknown): boolean {
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
        const set = this.uniqValuesAsSet

        // Turn into array, faster than spread operator
        const arr = new Array(set.size)
        let i = 0
        set.forEach((val) => (arr[i++] = val))
        return arr
    }

    @imemo get uniqValuesAsSet(): Set<JS_TYPE> {
        return new Set(this.values)
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

    @imemo get originalValueColumnSlug(): string | undefined {
        return getOriginalValueColumnSlug(this.table, this.slug)
    }

    @imemo get originalValues(): JS_TYPE[] {
        const { originalValueColumnSlug } = this
        if (!originalValueColumnSlug) return []
        return this.table.getValuesAtIndices(
            originalValueColumnSlug,
            this.validRowIndices
        ) as JS_TYPE[]
    }

    @imemo get minValue(): JS_TYPE | undefined {
        return _.min(this.values)
    }

    @imemo get maxValue(): JS_TYPE | undefined {
        return _.max(this.values)
    }

    @imemo get numErrorValues(): number {
        return this.valuesIncludingErrorValues.length - this.numValues
    }

    // Number of correctly parsed values
    @imemo get numValues(): number {
        return this.values.length
    }

    @imemo get numUniqs(): number {
        return this.uniqValuesAsSet.size
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
        return sortNumeric(_.uniq(this.allTimes))
    }

    // todo: remove. should not be on coretable
    @imemo get maxTime(): Time {
        return _.max(this.allTimes) as Time
    }

    // todo: remove. should not be on coretable
    @imemo get minTime(): Time {
        return _.min(this.allTimes) as Time
    }

    // todo: remove? Should not be on CoreTable
    @imemo get uniqEntityNames(): EntityName[] {
        return _.uniq(this.allEntityNames)
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
        const entities = this.allEntityNames
        const times = this.allTimes
        const values = this.values
        const originalTimes = this.originalTimes
        const originalValues = this.originalValues
        return _.range(0, originalTimes.length).map((index) => {
            return omitUndefinedValues({
                entityName: entities[index],
                time: times[index],
                value: values[index],
                originalTime: originalTimes[index],
                originalValue: originalValues[index],
            })
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
    @imemo get owidRowByEntityNameAndTime(): Map<
        EntityName,
        Map<Time, OwidVariableRow<JS_TYPE>>
    > {
        const valueByEntityNameAndTime = new Map<
            EntityName,
            Map<Time, OwidVariableRow<JS_TYPE>>
        >()
        this.owidRows.forEach((row) => {
            if (!valueByEntityNameAndTime.has(row.entityName))
                valueByEntityNameAndTime.set(row.entityName, new Map())
            valueByEntityNameAndTime.get(row.entityName)!.set(row.time, row)
        })
        return valueByEntityNameAndTime
    }

    // todo: remove? Should not be on CoreTable
    @imemo get valuesByTime(): Map<Time, JS_TYPE[]> {
        const map = new Map<Time, JS_TYPE[]>()
        this.owidRows.forEach((row) => {
            if (!map.has(row.time)) map.set(row.time, [])
            map.get(row.time)!.push(row.value)
        })
        return map
    }

    // todo: remove? Should not be on CoreTable
    @imemo get valueByTimeAndEntityName(): Map<Time, Map<EntityName, JS_TYPE>> {
        const valueByTimeAndEntityName = new Map<
            Time,
            Map<EntityName, JS_TYPE>
        >()
        this.owidRows.forEach((row) => {
            if (!valueByTimeAndEntityName.has(row.time))
                valueByTimeAndEntityName.set(row.time, new Map())
            valueByTimeAndEntityName
                .get(row.time)!
                .set(row.entityName, row.value)
        })
        return valueByTimeAndEntityName
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
                .set(row.originalTime, row.value)
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

    formatValue(value: unknown): string {
        return anyToString(value)
    }

    override parse(val: unknown): any {
        if (val === null) return ErrorValueTypes.NullButShouldBeString
        if (val === undefined) return ErrorValueTypes.UndefinedButShouldBeString
        return String(val) || ""
    }
}

class SeriesAnnotationColumn extends StringColumn {}
class CategoricalColumn extends StringColumn {}
class RegionColumn extends CategoricalColumn {}
class ContinentColumn extends RegionColumn {}
class ColorColumn extends CategoricalColumn {}
class BooleanColumn extends AbstractCoreColumn<boolean> {
    jsType = JsTypes.boolean

    formatValue(value: unknown): "true" | "false" {
        return value ? "true" : "false"
    }

    override parse(val: unknown): boolean {
        return !!val
    }
}

class OrdinalColumn extends CategoricalColumn {
    @imemo get allowedValuesSorted(): string[] | undefined {
        return this.def.sort
    }

    @imemo override get sortedUniqNonEmptyStringVals(): string[] {
        return this.allowedValuesSorted
            ? this.allowedValuesSorted
            : super.sortedUniqNonEmptyStringVals
    }
}

abstract class AbstractColumnWithNumberFormatting<
    T extends PrimitiveType,
> extends AbstractCoreColumn<T> {
    jsType = JsTypes.number

    formatValue(value: unknown, options?: TickFormattingOptions): string {
        if (_.isNumber(value)) {
            return formatValue(value, {
                roundingMode: this.roundingMode,
                numDecimalPlaces: this.numDecimalPlaces,
                numSignificantFigures: this.numSignificantFigures,
                ...options,
            })
        }
        return ""
    }

    override formatValueShortWithAbbreviations(
        value: unknown,
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

    override formatValueShort(
        value: unknown,
        options?: TickFormattingOptions
    ): string {
        return super.formatValueShort(value, {
            ...omitUndefinedValues({
                unit: this.shortUnit,
            }),
            ...options,
        })
    }

    override formatValueLong(
        value: unknown,
        options?: TickFormattingOptions
    ): string {
        return super.formatValueLong(value, {
            ...omitUndefinedValues({
                unit: this.unit,
            }),
            ...options,
        })
    }

    @imemo override get isAllIntegers(): boolean {
        return this.values.every(
            (val) => typeof val === "number" && val % 1 === 0
        )
    }
}

/**
 * We strive to have clearly typed variables in the future, but for now our
 * grapher variables are still untyped. Most are number-only, but we also have some
 * string-only, and even some mixed ones.
 * Hence, NumberOrStringColumn is used to store grapher variables.
 * It extends AbstractColumnWithNumberFormatting, which ensures that we have
 * implementations of formatValueShortWithAbbreviations and the like already.
 * -- @marcelgerber, 2022-07-01
 */
class NumberOrStringColumn extends AbstractColumnWithNumberFormatting<
    number | string
> {
    override formatValue(
        value: unknown,
        options?: TickFormattingOptions
    ): string {
        if (_.isNumber(value)) {
            return super.formatValue(value, options)
        }
        return anyToString(value)
    }
    override parse(val: unknown): number | string | ErrorValue {
        if (val === null) return ErrorValueTypes.NullButShouldBeNumber
        if (val === undefined) return ErrorValueTypes.UndefinedButShouldBeNumber
        if (Number.isNaN(val)) return ErrorValueTypes.NaNButShouldBeNumber

        const valAsString = String(val)
        const num = parseFloat(valAsString)
        if (Number.isNaN(num)) return valAsString // return string value

        return num
    }
}

abstract class AbstractNumericColumn extends AbstractColumnWithNumberFormatting<number> {
    override parse(val: unknown): number | ErrorValue {
        if (val === null) return ErrorValueTypes.NullButShouldBeNumber
        if (val === undefined) return ErrorValueTypes.UndefinedButShouldBeNumber
        if (val === "") return ErrorValueTypes.BlankButShouldBeNumber
        if (isNaN(Number(val))) return ErrorValueTypes.NaNButShouldBeNumber

        const res = this._parse(val)
        if (isNaN(res))
            return ErrorValueTypes.NotAParseableNumberButShouldBeNumber

        return res
    }

    protected _parse(val: unknown): number {
        return parseFloat(String(val))
    }
}

class NumericColumn extends AbstractNumericColumn {}
class NumericCategoricalColumn extends AbstractNumericColumn {}

class IntegerColumn extends NumericColumn {
    override formatValue(
        value: unknown,
        options?: TickFormattingOptions
    ): string {
        return super.formatValue(value, {
            numDecimalPlaces: 0,
            ...options,
        })
    }

    protected override _parse(val: unknown): number {
        return parseInt(String(val))
    }
}

class CurrencyColumn extends NumericColumn {
    override formatValue(
        value: unknown,
        options?: TickFormattingOptions
    ): string {
        return super.formatValue(value, {
            roundingMode: OwidVariableRoundingMode.decimalPlaces,
            numDecimalPlaces: 0,
            unit: this.shortUnit,
            ...options,
        })
    }

    @imemo override get shortUnit(): string {
        return "$"
    }
}

// Expects 50% to be 50
class PercentageColumn extends NumericColumn {
    override formatValue(
        value: number,
        options?: TickFormattingOptions
    ): string {
        return super.formatValue(value, {
            unit: this.shortUnit,
            ...options,
        })
    }

    @imemo override get shortUnit(): string {
        return "%"
    }
}

// Same as %, but indicates it's part of a group of columns that add up to 100%.
// Might not need this.
class RelativePercentageColumn extends PercentageColumn {}

class PercentChangeOverTimeColumn extends PercentageColumn {
    override formatValue(
        value: number,
        options?: TickFormattingOptions
    ): string {
        return super.formatValue(value, {
            showPlus: true,
            numDecimalPlaces: 1,
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

    @imemo override get displayName(): string {
        return _.capitalize(this.name)
    }

    override formatTime(time: number): string {
        return this.formatValue(time)
    }

    override parse(val: unknown): number | ErrorValue {
        return parseInt(String(val))
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

    // We cache these values because running `formatDay` thousands of times takes some time.
    static formatValueCache = new Map<number, string>()
    formatValue(value: number): string {
        if (!DayColumn.formatValueCache.has(value)) {
            const formatted = formatDay(value)
            DayColumn.formatValueCache.set(value, formatted)
            return formatted
        }
        return DayColumn.formatValueCache.get(value)!
    }

    static formatValueForMobileCache = new Map<number, string>()
    override formatValueForMobile(value: number): string {
        if (!DayColumn.formatValueForMobileCache.has(value)) {
            const formatted = formatDay(value, { format: "MMM D, 'YY" })
            DayColumn.formatValueForMobileCache.set(value, formatted)
            return formatted
        }
        return DayColumn.formatValueForMobileCache.get(value)!
    }

    static formatForCsvCache = new Map<number, string>()
    override formatForCsv(value: number): string {
        if (!DayColumn.formatForCsvCache.has(value)) {
            const formatted = formatDay(value, { format: "YYYY-MM-DD" })
            DayColumn.formatForCsvCache.set(value, formatted)
            return formatted
        }
        return DayColumn.formatForCsvCache.get(value)!
    }
}

const dateToTimeCache = new Map<string, Time>() // Cache for performance
class DateColumn extends DayColumn {
    override parse(val: unknown): number {
        // skip parsing if a date is a number, it's already been parsed
        if (typeof val === "number") return val
        const valAsString = String(val)
        if (!dateToTimeCache.has(valAsString))
            dateToTimeCache.set(
                valAsString,
                dateDiffInDays(
                    dayjs.utc(valAsString).toDate(),
                    dayjs.utc("2020-01-21").toDate()
                )
            )
        return dateToTimeCache.get(valAsString)!
    }
}

class QuarterColumn extends TimeColumn {
    preposition = "in"

    private static regEx = /^([+-]?\d+)-Q([1-4])$/

    override parse(val: unknown): number | ErrorValue {
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

    override formatForCsv(value: number): string {
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
    Ordinal: OrdinalColumn,
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

const _ColumnTypeMap: {
    [key in ColumnTypeNames]: unknown
} = ColumnTypeMap
