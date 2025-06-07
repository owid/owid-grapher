import { ChartSeries } from "../chart/ChartInterface"
import { Bounds } from "@ourworldindata/utils"
import { MapChartManager } from "../mapCharts/MapChartConstants"

export type FacetMapManager = MapChartManager

export interface FacetMapProps {
    bounds?: Bounds
    manager: FacetMapManager
}

export interface MapFacetSeries extends ChartSeries {
    manager: Partial<MapChartManager>
}

export interface PlacedMapFacetSeries extends MapFacetSeries {
    manager: MapChartManager
    bounds: Bounds
}
