import { ChartSeries } from "../chart/ChartInterface"

export type StackedPointPositionType = string | number

// PositionType can be categorical (e.g. country names), or ordinal (e.g. years).
export interface StackedPoint<PositionType extends StackedPointPositionType> {
    position: PositionType
    value: number
    valueOffset: number
    fake?: boolean
}

export interface StackedSeries<PositionType extends StackedPointPositionType>
    extends ChartSeries {
    points: StackedPoint<PositionType>[]
    isProjection?: boolean
}
