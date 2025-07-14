import React from "react"
import { Bounds } from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { LineChartState } from "./LineChartState"

@observer
export class LineChartThumbnail
    extends React.Component<{
        bounds?: Bounds
        chartState: LineChartState
    }>
    implements ChartInterface
{
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
