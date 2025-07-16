import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import type { DiscreteBarChartProps } from "./DiscreteBarChart.js"

@observer
export class DiscreteBarChartThumbnail
    extends React.Component<DiscreteBarChartProps>
    implements ChartInterface
{
    constructor(props: DiscreteBarChartProps) {
        super(props)
        makeObservable(this)
    }

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
