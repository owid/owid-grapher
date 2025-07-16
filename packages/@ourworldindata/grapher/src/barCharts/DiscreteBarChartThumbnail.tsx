import React from "react"
import { Bounds } from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { DiscreteBarChartState } from "./DiscreteBarChartState"

@observer
export class DiscreteBarChartThumbnail
    extends React.Component<{
        bounds?: Bounds
        chartState: DiscreteBarChartState
    }>
    implements ChartInterface
{
    @computed get chartState(): DiscreteBarChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Discrete bar chart thumbnail
            </text>
        )
    }
}
