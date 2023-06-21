import { ObservableMap } from "mobx"
import { CoreColumn } from "@ourworldindata/core-table"
import { TickFormattingOptions } from "@ourworldindata/utils"

// We can't pass the property directly because we need it to be observable.
export interface TooltipManager {
    tooltips?: ObservableMap<TooltipProps["id"], TooltipProps>
}

export interface TooltipProps {
    id: number | string
    x: number
    y: number
    offsetX?: number
    offsetY?: number
    offsetYDirection?: "upward" | "downward"
    title?: string | number
    subtitle?: string | number
    subtitleIsUnit?: boolean
    footer?: string
    style?: React.CSSProperties
    children?: React.ReactNode
    tooltipManager: TooltipManager
}

export interface TooltipValueProps {
    column: CoreColumn
    value?: number | string
    color?: string
    notice?: number | string
}

export interface TooltipValueRangeProps {
    column: CoreColumn
    values: number[]
    color?: string
}

export interface TooltipTableProps {
    columns: CoreColumn[]
    rows: TooltipTableRow[]
    totals?: (number | undefined)[]
    notices?: (number | string | undefined)[]
    format?: TickFormattingOptions
}

export interface TooltipTableRow {
    name: string
    annotation?: string
    swatch?: string
    focused?: boolean
    blurred?: boolean
    values: (string | number | undefined)[]
}

export interface TooltipTableData {
    value: number
    fake?: boolean
}
