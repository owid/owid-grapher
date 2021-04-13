// DEPRECATED. DO NOT USE.

export interface LegacyVariableDisplayConfigInterface {
    readonly name?: string
    readonly unit?: string
    readonly shortUnit?: string
    readonly isProjection?: boolean
    readonly conversionFactor?: number
    readonly numDecimalPlaces?: number
    readonly tolerance?: number
    readonly yearIsDay?: boolean
    readonly zeroDay?: string
    readonly entityAnnotationsMap?: string
    readonly includeInTable?: boolean
    readonly tableDisplay?: LegacyVariableDataTableConfigInteface
    readonly color?: string
}

// todo: flatten onto the above
export interface LegacyVariableDataTableConfigInteface {
    hideAbsoluteChange?: boolean
    hideRelativeChange?: boolean
}
