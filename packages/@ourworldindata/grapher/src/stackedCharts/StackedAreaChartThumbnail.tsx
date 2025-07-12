import React from "react"
import { Bounds } from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedAreaChartState } from "./StackedAreaChartState.js"

@observer
export class StackedAreaChartThumbnail
    extends React.Component<{
        bounds?: Bounds
        chartState: StackedAreaChartState
    }>
    implements ChartInterface
{
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
