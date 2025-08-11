import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import { type DiscreteBarChartProps } from "./DiscreteBarChart.js"
import { DiscreteBars } from "./DiscreteBars"

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

    override render(): React.ReactElement {
        return <DiscreteBars {...this.props} series={this.chartState.series} />
    }
}
