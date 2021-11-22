import {
    ColumnSlug,
    DimensionProperty,
    OwidVariableId,
    Time,
} from "./owidTypes"

export interface OwidVariableDisplayConfigInterface {
    name?: string
    unit?: string
    shortUnit?: string
    isProjection?: boolean
    conversionFactor?: number
    numDecimalPlaces?: number
    tolerance?: number
    yearIsDay?: boolean
    zeroDay?: string
    entityAnnotationsMap?: string
    includeInTable?: boolean
    tableDisplay?: OwidVariableDataTableConfigInteface
    color?: string
}

// todo: flatten onto the above
export interface OwidVariableDataTableConfigInteface {
    hideAbsoluteChange?: boolean
    hideRelativeChange?: boolean
}

export interface OwidChartDimensionInterface {
    property: DimensionProperty
    targetYear?: Time
    display?: OwidVariableDisplayConfigInterface
    variableId: OwidVariableId
    slug?: ColumnSlug
}
