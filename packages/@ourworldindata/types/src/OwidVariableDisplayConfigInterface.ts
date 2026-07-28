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

export interface OwidChartDimensionInterface {
    property: DimensionProperty
    targetYear?: Time
    display?: OwidVariableDisplayConfigInterface
    variableId: OwidVariableId
    slug?: ColumnSlug
}

export interface OwidChartDimensionInterfaceWithMandatorySlug extends OwidChartDimensionInterface {
    slug: ColumnSlug
}
