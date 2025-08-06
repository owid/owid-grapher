import * as _ from "lodash-es"
import * as React from "react"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Time } from "@ourworldindata/utils"
import { BAR_OPACITY, StackedPoint, StackedSeries } from "./StackedConstants"
import { VerticalAxis } from "../axis/Axis"

interface StackedBarSegmentProps extends React.SVGAttributes<SVGGElement> {
    id: string
    bar: StackedPoint<Time>
    series: StackedSeries<Time>
    color: string
    opacity: number
    yAxis: VerticalAxis
    xOffset: number
    barWidth: number
    onBarMouseOver?: (
        bar: StackedPoint<Time>,
        series: StackedSeries<Time>
    ) => void
    onBarMouseLeave?: () => void
}

@observer
export class StackedBarSegment extends React.Component<StackedBarSegmentProps> {
    base = React.createRef<SVGRectElement>()

    constructor(props: StackedBarSegmentProps) {
        super(props)

        makeObservable(this, {
            mouseOver: observable,
        })
    }

    mouseOver: boolean = false

    @computed get yPos(): number {
        const { bar, yAxis } = this.props
        // The top position of a bar
        return bar.value < 0
            ? yAxis.place(bar.valueOffset)
            : yAxis.place(bar.value + bar.valueOffset)
    }

    @computed get barHeight(): number {
        const { bar, yAxis } = this.props
        return bar.value < 0
            ? yAxis.place(bar.valueOffset + bar.value) - this.yPos
            : yAxis.place(bar.valueOffset) - this.yPos
    }

    @computed get trueOpacity(): number {
        return this.mouseOver ? BAR_OPACITY.FOCUS : this.props.opacity
    }

    @action.bound onBarMouseOver(): void {
        this.mouseOver = true
        this.props.onBarMouseOver?.(this.props.bar, this.props.series)
    }

    @action.bound onBarMouseLeave(): void {
        this.mouseOver = false
        this.props.onBarMouseLeave?.()
    }

    override render(): React.ReactElement {
        const { color, xOffset, barWidth } = this.props
        const { yPos, barHeight, trueOpacity } = this

        return (
            <rect
                id={this.props.id}
                ref={this.base}
                x={xOffset}
                y={yPos}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity={trueOpacity}
                onMouseOver={this.onBarMouseOver}
                onMouseLeave={this.onBarMouseLeave}
            />
        )
    }
}
