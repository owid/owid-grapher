import { DimensionProperty } from "@ourworldindata/types"

export type FieldWithDetailReferences =
    | "subtitle"
    | "note"
    | "axisLabelX"
    | "axisLabelY"

type ErrorMessageFieldName = FieldWithDetailReferences | "focusedSeriesNames"

export type ErrorMessages = Partial<Record<ErrorMessageFieldName, string>>

export type ErrorMessagesForDimensions = Record<DimensionProperty, string[]>
