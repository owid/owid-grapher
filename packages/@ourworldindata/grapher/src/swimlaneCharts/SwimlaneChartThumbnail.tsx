import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { SwimlaneChartState } from "./SwimlaneChartState"
import { SwimlaneChart, SwimlaneChartProps } from "./SwimlaneChart"

@observer
export class SwimlaneChartThumbnail
    extends React.Component<SwimlaneChartProps>
    implements ChartInterface
{
    constructor(props: SwimlaneChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): SwimlaneChartState {
        return this.props.chartState
    }

    override render(): React.ReactElement {
        return <SwimlaneChart {...this.props} />
    }
}
