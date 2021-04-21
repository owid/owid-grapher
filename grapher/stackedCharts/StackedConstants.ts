import { ChartSeries } from "../chart/ChartInterface"

export interface StackedPoint {
    x: number
    y: number
    yOffset: number
    fake?: boolean
}

export interface StackedSeries extends ChartSeries {
    points: StackedPoint[]
    isProjection?: boolean
}
