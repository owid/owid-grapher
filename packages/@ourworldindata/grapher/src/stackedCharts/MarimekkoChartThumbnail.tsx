import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MarimekkoChartState } from "./MarimekkoChartState"
import type { MarimekkoChartProps } from "./MarimekkoChart.js"

@observer
export class MarimekkoChartThumbnail
    extends React.Component<MarimekkoChartProps>
    implements ChartInterface
{
    constructor(props: MarimekkoChartProps) {
        super(props)
        makeObservable(this)
    }

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
