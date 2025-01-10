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
    yearIsDay?: boolean
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

export interface OwidChartDimensionInterface {
    property: DimensionProperty
    targetYear?: Time
    display?: OwidVariableDisplayConfigInterface
    variableId: OwidVariableId
    slug?: ColumnSlug
}

export interface OwidChartDimensionInterfaceWithMandatorySlug
    extends OwidChartDimensionInterface {
    slug: ColumnSlug
}
