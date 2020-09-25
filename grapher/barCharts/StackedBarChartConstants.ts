import { EntityName } from "coreTable/CoreTableConstants"
import { VerticalAxis } from "grapher/axis/Axis"

export interface StackedBarSegmentProps
    extends React.SVGAttributes<SVGGElement> {
    bar: StackedBarPoint
    color: string
    opacity: number
    yAxis: VerticalAxis
    xOffset: number
    barWidth: number
    onBarMouseOver: (bar: StackedBarPoint) => void
    onBarMouseLeave: () => void
}

export interface StackedBarPoint {
    x: number
    y: number
    yOffset: number
    label: string
}

export interface StackedBarSeries {
    entityName: EntityName
    label: string
    points: StackedBarPoint[]
    color: string
}
