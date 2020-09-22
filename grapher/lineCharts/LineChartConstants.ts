import { EntityName } from "coreTable/CoreTableConstants"
import { DualAxis, HorizontalAxis, VerticalAxis } from "grapher/axis/Axis"
import { Vector2 } from "grapher/utils/Vector2"

export interface LineChartValue {
    x: number
    y: number
    time: number
}

export interface LineChartSeries {
    entityName: string
    color: string
    values: LineChartValue[]
    classed?: string
    isProjection?: boolean
}

export interface LinesProps {
    dualAxis: DualAxis
    xAxis: HorizontalAxis
    yAxis: VerticalAxis
    data: LineChartSeries[]
    focusKeys: EntityName[]
    onHover: (hoverX: number | undefined) => void
}

export interface LineRenderSeries {
    entityName: string
    displayKey: string
    color: string
    values: Vector2[]
    isFocus: boolean
    isProjection?: boolean
}

export interface LineHoverTarget {
    pos: Vector2
    series: LineChartSeries
    value: LineChartValue
}
