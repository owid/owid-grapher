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
    style?: React.CSSProperties
    children?: React.ReactNode
    tooltipManager: TooltipManager
}
