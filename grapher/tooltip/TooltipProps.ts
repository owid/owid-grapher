// We can't pass the property directly because we need it to be observable.
export interface TooltipManager {
    tooltip?: TooltipProps
}

export interface TooltipProps {
    readonly x: number
    readonly y: number
    readonly offsetX?: number
    readonly offsetY?: number
    readonly offsetYDirection?: "upward" | "downward"
    readonly style?: React.CSSProperties
    readonly children?: React.ReactNode
    readonly tooltipManager: TooltipManager
}
