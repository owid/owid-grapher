import { DimensionProperty } from "@ourworldindata/types"

export type FieldWithDetailReferences =
    | "subtitle"
    | "note"
    | "axisLabelX"
    | "axisLabelY"

export interface DimensionErrorMessage {
    displayName?: string
}

export type ErrorMessages = Partial<Record<FieldWithDetailReferences, string>>

export type ErrorMessagesForDimensions = Record<
    DimensionProperty,
    DimensionErrorMessage[]
>
