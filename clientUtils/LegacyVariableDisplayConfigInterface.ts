// DEPRECATED. DO NOT USE.

import {
    ColumnSlug,
    DimensionProperty,
    LegacyVariableId,
    Time,
} from "./owidTypes"

export interface LegacyVariableDisplayConfigInterface {
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
    tableDisplay?: LegacyVariableDataTableConfigInteface
    color?: string
}

// todo: flatten onto the above
export interface LegacyVariableDataTableConfigInteface {
    hideAbsoluteChange?: boolean
    hideRelativeChange?: boolean
}

export interface LegacyChartDimensionInterface {
    property: DimensionProperty
    targetYear?: Time
    display?: LegacyVariableDisplayConfigInterface
    variableId: LegacyVariableId
    slug?: ColumnSlug
}
