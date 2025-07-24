import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { LineChartState } from "./LineChartState"
import { LineChart, LineChartProps } from "./LineChart.js"

@observer
export class LineChartThumbnail
    extends React.Component<LineChartProps>
    implements ChartInterface
{
    constructor(props: LineChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): LineChartState {
        return this.props.chartState
    }

    override render(): React.ReactElement {
        return <LineChart {...this.props} />
    }
}
