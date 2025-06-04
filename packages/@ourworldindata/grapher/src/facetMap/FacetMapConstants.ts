import { ChartSeries } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { Bounds, ColumnSlug } from "@ourworldindata/utils"
import { MapChartManager } from "../mapCharts/MapChartConstants"
import { MapConfig } from "../mapCharts/MapConfig"

export interface FacetMapManager extends ChartManager {
    canSelectMultipleEntities?: boolean
    mapColumnSlug?: ColumnSlug
    mapConfig?: MapConfig
    isMapSelectionEnabled?: boolean
}

export interface FacetMapProps {
    bounds?: Bounds
    manager: FacetMapManager
}

export interface FacetSeries extends ChartSeries {
    manager: Partial<MapChartManager>
}

export interface PlacedFacetSeries extends FacetSeries {
    manager: MapChartManager
    bounds: Bounds
}
