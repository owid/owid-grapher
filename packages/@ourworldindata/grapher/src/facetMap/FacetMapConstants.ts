import { ChartSeries } from "../chart/ChartInterface"
import { Bounds } from "@ourworldindata/utils"
import { MapChartManager } from "../mapCharts/MapChartConstants"
import {
    GrapherAnalytics,
    GrapherAnalyticsContext,
} from "../core/GrapherAnalytics"

export interface FacetMapManager extends MapChartManager {
    analytics?: GrapherAnalytics
    analyticsContext?: GrapherAnalyticsContext
}

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
