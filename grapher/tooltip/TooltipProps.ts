// We can't pass the property directly because we need it to be observable.
export interface TooltipProvider {
    tooltip?: TooltipProps
}

export interface TooltipProps {
    x: number
    y: number
    offsetX?: number
    offsetY?: number
    offsetYDirection?: "upward" | "downward"
    style?: React.CSSProperties
    children?: React.ReactNode
    tooltipProvider: TooltipProvider
}
