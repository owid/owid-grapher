import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedAreaChartState } from "./StackedAreaChartState.js"
import {
    StackedAreaChart,
    type StackedAreaChartProps,
} from "./StackedAreaChart.js"

@observer
export class StackedAreaChartThumbnail
    extends React.Component<StackedAreaChartProps>
    implements ChartInterface
{
    constructor(props: StackedAreaChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): StackedAreaChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return <StackedAreaChart {...this.props} />
    }
}
