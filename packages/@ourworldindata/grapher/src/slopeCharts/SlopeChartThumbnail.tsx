import React from "react"
import { Bounds } from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { SlopeChartState } from "./SlopeChartState.js"

@observer
export class SlopeChartThumbnail
    extends React.Component<{
        bounds?: Bounds
        chartState: SlopeChartState
    }>
    implements ChartInterface
{
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
