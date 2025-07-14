import React from "react"
import { Bounds } from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"

@observer
export class StackedDiscreteBarChartThumbnail
    extends React.Component<{
        bounds?: Bounds
        chartState: StackedDiscreteBarChartState
    }>
    implements ChartInterface
{
    @computed get chartState(): StackedDiscreteBarChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Stacked discrete bar chart thumbnail
            </text>
        )
    }
}
