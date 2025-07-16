import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedBarChartState } from "./StackedBarChartState.js"
import type { StackedBarChartProps } from "./StackedBarChart.js"

@observer
export class StackedBarChartThumbnail
    extends React.Component<StackedBarChartProps>
    implements ChartInterface
{
    constructor(props: StackedBarChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): StackedBarChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Stacked bar chart thumbnail
            </text>
        )
    }
}
