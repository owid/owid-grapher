import { DimensionProperty } from "@ourworldindata/types"

export type FieldWithDetailReferences =
    | "subtitle"
    | "note"
    | "axisLabelX"
    | "axisLabelY"

type ErrorMessageFieldName =
    | FieldWithDetailReferences
    | "focusedSeriesNames"
    | `map.colorScale.${string}`
    | `colorScale.${string}`
    | "originUrl"

export type ErrorMessages = Partial<Record<ErrorMessageFieldName, string>>

export type ErrorMessagesForDimensions = Record<DimensionProperty, string[]>
