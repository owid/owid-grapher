import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { SlopeChartState } from "./SlopeChartState.js"
import type { SlopeChartProps } from "./SlopeChart.js"

@observer
export class SlopeChartThumbnail
    extends React.Component<SlopeChartProps>
    implements ChartInterface
{
    constructor(props: SlopeChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): SlopeChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Slope chart thumbnail
            </text>
        )
    }
}
