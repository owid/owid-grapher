import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedAreaChartState } from "./StackedAreaChartState.js"
import type { StackedAreaChartProps } from "./StackedAreaChart.js"

@observer
export class StackedAreaChartThumbnail
    extends React.Component<StackedAreaChartProps>
    implements ChartInterface
{
    constructor(props: StackedAreaChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): StackedAreaChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Stacked area chart thumbnail
            </text>
        )
    }
}
