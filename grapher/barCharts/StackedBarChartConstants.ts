import { EntityName } from "coreTable/CoreTableConstants"
import { VerticalAxis } from "grapher/axis/Axis"

export interface StackedBarSegmentProps
    extends React.SVGAttributes<SVGGElement> {
    bar: StackedBarValue
    color: string
    opacity: number
    yAxis: VerticalAxis
    xOffset: number
    barWidth: number
    onBarMouseOver: (bar: StackedBarValue) => void
    onBarMouseLeave: () => void
}

export interface StackedBarValue {
    x: number
    y: number
    yOffset: number
    isFake: boolean
    label: string
}

export interface StackedBarSeries {
    entityName: EntityName
    label: string
    values: StackedBarValue[]
    color: string
}
