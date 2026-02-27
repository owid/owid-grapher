import * as React from "react"
import { computed, action, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { Time } from "@ourworldindata/utils"
import {
    BAR_OPACITY,
    StackedPoint,
    PlacedStackedBarSeries,
} from "./StackedConstants"

interface StackedBarSegmentProps extends React.SVGAttributes<SVGGElement> {
    id: string
    bar: StackedPoint<Time>
    series: PlacedStackedBarSeries<Time>
    color: string
    opacity: number
    x: number
    y: number
    barWidth: number
    barHeight: number
    onBarMouseOver?: (
        bar: StackedPoint<Time>,
        series: PlacedStackedBarSeries<Time>
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
        const { color, x, y, barWidth, barHeight } = this.props
        const { trueOpacity } = this

        return (
            <rect
                id={this.props.id}
                ref={this.base}
                x={x}
                y={y}
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
