import { ChartSeries } from "../chart/ChartInterface"

export interface StackedPoint {
    readonly x: number
    readonly y: number
    readonly fake?: boolean
    yOffset: number
}

export interface StackedSeries extends ChartSeries {
    readonly points: readonly StackedPoint[]
    readonly isProjection?: boolean
}
