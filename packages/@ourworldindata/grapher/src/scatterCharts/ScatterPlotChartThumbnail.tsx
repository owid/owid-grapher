import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { ScatterPlotChartState } from "./ScatterPlotChartState"
import type { ScatterPlotChartProps } from "./ScatterPlotChart.js"

@observer
export class ScatterPlotChartThumbnail
    extends React.Component<ScatterPlotChartProps>
    implements ChartInterface
{
    constructor(props: ScatterPlotChartProps) {
        super(props)
        makeObservable(this)
    }
    @computed get chartState(): ScatterPlotChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Scatter plot thumbnail
            </text>
        )
    }
}
