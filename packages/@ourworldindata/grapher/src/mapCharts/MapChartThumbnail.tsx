import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MapChartState } from "./MapChartState"
import { MapChartProps } from "./MapChart"
import {
    ChoroplethMapManager,
    ChoroplethSeriesByName,
} from "./MapChartConstants"
import { Bounds } from "@ourworldindata/utils"
import { DEFAULT_GRAPHER_BOUNDS } from "../core/GrapherConstants"
import { MapConfig } from "./MapConfig"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChoroplethMap } from "./ChoroplethMap.js"

@observer
export class MapChartThumbnail
    extends React.Component<MapChartProps>
    implements ChartInterface, ChoroplethMapManager
{
    constructor(props: MapChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): MapChartState {
        return this.props.chartState
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed get choroplethMapBounds(): Bounds {
        return this.bounds
    }

    @computed get choroplethData(): ChoroplethSeriesByName {
        return this.chartState.seriesMap
    }

    @computed get mapConfig(): MapConfig {
        return this.chartState.mapConfig
    }

    @computed get mapColumn(): CoreColumn {
        return this.chartState.mapColumn
    }

    override render(): React.ReactElement {
        // TODO: Render MapChart with legend
        return <ChoroplethMap manager={this} />
    }
}
