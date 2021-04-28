import { ChartSeries } from "../chart/ChartInterface"

export interface StackedPoint {
    position: number
    value: number
    valueOffset: number
    fake?: boolean
    color?: string
}

export interface StackedSeries extends ChartSeries {
    points: StackedPoint[]
    isProjection?: boolean
}
