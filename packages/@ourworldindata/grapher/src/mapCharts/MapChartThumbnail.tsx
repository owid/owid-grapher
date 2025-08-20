import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MapChartState } from "./MapChartState"
import { MapChart, MapChartProps } from "./MapChart"
import {
    ChoroplethMapManager,
    ChoroplethSeriesByName,
    MapChartManager,
} from "./MapChartConstants"
import { Bounds, GrapherVariant } from "@ourworldindata/utils"
import { DEFAULT_GRAPHER_BOUNDS } from "../core/GrapherConstants"
import { MapConfig } from "./MapConfig"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChoroplethMap } from "./ChoroplethMap.js"
import { ChoroplethGlobe } from "./ChoroplethGlobe"

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

    @computed private get manager(): MapChartManager {
        return this.chartState.manager
    }

    @computed private get isMinimal(): boolean {
        return this.manager.variant === GrapherVariant.MinimalThumbnail
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

    private renderMapOrGlobe(): React.ReactElement {
        return this.mapConfig.globe.isActive ? (
            <ChoroplethGlobe manager={this} />
        ) : (
            <ChoroplethMap manager={this} />
        )
    }

    override render(): React.ReactElement {
        // The minimal version only renders the map, without legend
        return this.isMinimal ? (
            this.renderMapOrGlobe()
        ) : (
            <MapChart {...this.props} />
        )
    }
}
