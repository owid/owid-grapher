import { Color } from "coreTable/CoreTableConstants"
import { ChartSeries } from "grapher/chart/ChartInterface"

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
