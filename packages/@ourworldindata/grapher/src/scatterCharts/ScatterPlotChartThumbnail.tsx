import React from "react"
import { Bounds } from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { ScatterPlotChartState } from "./ScatterPlotChartState"

@observer
export class ScatterPlotChartThumbnail
    extends React.Component<{
        bounds?: Bounds
        chartState: ScatterPlotChartState
    }>
    implements ChartInterface
{
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
