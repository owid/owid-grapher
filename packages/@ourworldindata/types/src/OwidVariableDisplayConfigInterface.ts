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
 * `display` belongs to the chart, not to the data: it overrides what the
 * column's own definition says.
 */
interface OwidChartDimensionBaseInterface {
    property: DimensionProperty
    display?: OwidVariableDisplayConfigInterface
}

/** A slot filled by an OWID indicator, fetched from the data API */
export interface IndicatorDimensionInterface extends OwidChartDimensionBaseInterface {
    variableId: OwidVariableId
    /** Pins the slot to a single year, as scatter plots and Marimekko charts do for x or size */
    targetYear?: Time
    slug?: never
}

/** A slot filled by a column of a table the host supplies */
export interface HostColumnDimensionInterface extends OwidChartDimensionBaseInterface {
    slug: ColumnSlug
    variableId?: never
    targetYear?: never
}

/** A slot names its column by `variableId` or by `slug`, never both */
export type OwidChartDimensionInterface =
    | IndicatorDimensionInterface
    | HostColumnDimensionInterface

export const isIndicatorDimension = (
    dimension: OwidChartDimensionInterface
): dimension is IndicatorDimensionInterface =>
    dimension.variableId !== undefined
