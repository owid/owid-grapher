import React from "react"
import { Bounds } from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedBarChartState } from "./StackedBarChartState.js"

@observer
export class StackedBarChartThumbnail
    extends React.Component<{
        bounds?: Bounds
        chartState: StackedBarChartState
    }>
    implements ChartInterface
{
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
