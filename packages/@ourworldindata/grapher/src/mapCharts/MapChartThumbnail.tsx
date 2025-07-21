import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MapChartState } from "./MapChartState"
import { MapChart, MapChartProps } from "./MapChart"

@observer
export class MapChartThumbnail
    extends React.Component<MapChartProps>
    implements ChartInterface
{
    constructor(props: MapChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): MapChartState {
        return this.props.chartState
    }

    render(): React.ReactElement {
        return <MapChart {...this.props} />
    }
}
