import { OwidVariableId } from "./domainTypes/Various.js"
import {
    ColumnSlug,
    DimensionProperty,
    Time,
} from "./grapherTypes/GrapherTypes.js"

export interface OwidVariableDisplayConfigInterface {
    name?: string
    unit?: string
    shortUnit?: string
    isProjection?: boolean
    conversionFactor?: number
    roundingMode?: OwidVariableRoundingMode
    numDecimalPlaces?: number
    numSignificantFigures?: number
    tolerance?: number
    timeInterval?: TimeInterval
    zeroDay?: string
    entityAnnotationsMap?: string
    includeInTable?: boolean
    tableDisplay?: OwidVariableDataTableConfigInterface
    color?: string
    plotMarkersOnlyInLineChart?: boolean
}

// todo: flatten onto the above
export interface OwidVariableDataTableConfigInterface {
    hideAbsoluteChange?: boolean
    hideRelativeChange?: boolean
}

export enum OwidVariableRoundingMode {
    decimalPlaces = "decimalPlaces",
    significantFigures = "significantFigures",
}

/**
 * Time resolution at which an indicator's time values should be interpreted and
 * formatted. Sub-yearly intervals (day/week/month/quarter) are encoded as
 * days-since-epoch; `year` and `decade` values are literal years.
 */
export enum TimeInterval {
    Day = "day",
    Week = "week",
    Month = "month",
    Quarter = "quarter",
    Year = "year",
    Decade = "decade",
}

/** Sub-yearly intervals, finest first */
export const SUB_YEARLY_TIME_INTERVALS = [
    TimeInterval.Day,
    TimeInterval.Week,
    TimeInterval.Month,
    TimeInterval.Quarter,
] as const

/** All time intervals, finest first */
export const TIME_INTERVALS = [
    ...SUB_YEARLY_TIME_INTERVALS,
    TimeInterval.Year,
    TimeInterval.Decade,
] as const

export type SubYearlyTimeInterval = (typeof SUB_YEARLY_TIME_INTERVALS)[number]

/**
 * One slot of a chart (its y values, its x values, what colours or sizes the
 * points) bound to one column of data, plus what this chart says about that
 * column.
 *
 * The column is named either by `variableId`, an OWID indicator fetched from
 * the data API, or by `slug`, a column in a table the host supplies. Exactly
 * one of the two is the authored form; see `OwidChartDimensionInterfaceWithMandatoryVariableId`
 * for the OWID-only pipelines that always have an indicator.
 *
 * `display` belongs to the chart, not to the data: it overrides what the
 * column's own definition says, and it is the reason a slot is an object
 * rather than a bare column name.
 */
export interface OwidChartDimensionInterface {
    property: DimensionProperty
    targetYear?: Time
    display?: OwidVariableDisplayConfigInterface
    variableId?: OwidVariableId
    slug?: ColumnSlug
}

/**
 * A dimension after the table has been assembled, when every slot knows which
 * column of that table it points at.
 */
export interface OwidChartDimensionInterfaceWithMandatorySlug extends OwidChartDimensionInterface {
    slug: ColumnSlug
}

/**
 * A dimension bound to an OWID indicator. Everything that reads chart configs
 * out of our own database (the baker, archival, the admin) works with these:
 * a chart row's dimensions always name an indicator.
 */
export interface OwidChartDimensionInterfaceWithMandatoryVariableId extends OwidChartDimensionInterface {
    variableId: OwidVariableId
}

/** Whether this slot is filled by an OWID indicator rather than by a column
 *  the host supplied. */
export const isIndicatorDimension = (
    dimension: OwidChartDimensionInterface
): dimension is OwidChartDimensionInterfaceWithMandatoryVariableId =>
    dimension.variableId !== undefined
