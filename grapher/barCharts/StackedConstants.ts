import { SeriesName } from "grapher/core/GrapherConstants"

export interface StackedPoint {
    x: number
    y: number
    yOffset: number
    fake?: boolean
}

export interface StackedSeries {
    seriesName: SeriesName
    points: StackedPoint[]
    color: string
    isProjection?: boolean
}
