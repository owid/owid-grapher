import React from "react"
import { Bounds } from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MarimekkoChartState } from "./MarimekkoChartState"

@observer
export class MarimekkoChartThumbnail
    extends React.Component<{
        bounds?: Bounds
        chartState: MarimekkoChartState
    }>
    implements ChartInterface
{
    @computed get chartState(): MarimekkoChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Marimekko chart thumbnail
            </text>
        )
    }
}
