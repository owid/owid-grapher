import { OwidVariableRow } from "../../coreTable/OwidTableConstants.js"
import { ChartSeries } from "../chart/ChartInterface.js"
import { SeriesName } from "../core/GrapherConstants.js"

export type StackedPointPositionType = string | number

// PositionType can be categorical (e.g. country names), or ordinal (e.g. years).
export interface StackedPoint<PositionType extends StackedPointPositionType> {
    position: PositionType
    value: number
    valueOffset: number
    time: number
    fake?: boolean
}

export interface StackedSeries<PositionType extends StackedPointPositionType>
    extends ChartSeries {
    points: StackedPoint<PositionType>[]
    columnSlug?: string
    isProjection?: boolean
}

export interface StackedRawSeries<
    PositionType extends StackedPointPositionType
> {
    seriesName: SeriesName
    isProjection?: boolean
    rows: OwidVariableRow<PositionType>[]
}
