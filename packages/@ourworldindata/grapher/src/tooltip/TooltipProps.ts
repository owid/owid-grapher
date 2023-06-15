import { IconDefinition } from "@fortawesome/fontawesome-common-types/index.js"
import { ObservableMap } from "mobx"

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
    footerIcon?: IconDefinition
    footer?: string
    style?: React.CSSProperties
    children?: React.ReactNode
    tooltipManager: TooltipManager
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
