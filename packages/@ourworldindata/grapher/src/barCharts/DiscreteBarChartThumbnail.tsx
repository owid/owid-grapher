import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import {
    DiscreteBarChart,
    type DiscreteBarChartProps,
} from "./DiscreteBarChart.js"

import { DiscreteBarChartManager } from "./DiscreteBarChartConstants.js"

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

    @computed get manager(): DiscreteBarChartManager {
        return this.props.chartState.manager
    }

    override render(): React.ReactElement {
        return <DiscreteBarChart {...this.props} />
    }
}
