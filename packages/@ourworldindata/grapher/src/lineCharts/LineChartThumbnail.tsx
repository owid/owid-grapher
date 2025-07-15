import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { LineChartState } from "./LineChartState"
import { LineChartProps } from "./LineChart.js"

@observer
export class LineChartThumbnail
    extends React.Component<LineChartProps>
    implements ChartInterface
{
    constructor(props: LineChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): LineChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Line chart thumbnail
            </text>
        )
    }
}
