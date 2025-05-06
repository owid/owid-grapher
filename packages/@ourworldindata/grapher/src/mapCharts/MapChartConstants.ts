import { ColorScaleBin } from "../color/ColorScaleBin"
import { Bounds, PointVector, ColumnSlug } from "@ourworldindata/utils"
import {
    MapRegionName,
    Color,
    Time,
    GrapherChartType,
    GrapherTabConfigOption,
    SeriesName,
} from "@ourworldindata/types"
import { ChartManager } from "../chart/ChartManager"
import { MapConfig } from "./MapConfig"
import { ChartSeries } from "../chart/ChartInterface"

export type GeoFeature = GeoJSON.Feature<GeoJSON.GeometryObject>
export type MapBracket = ColorScaleBin
export const MAP_HOVER_TARGET_RANGE = 20

export const DEFAULT_STROKE_COLOR = "#333"
export const CHOROPLETH_MAP_CLASSNAME = "ChoroplethMap"

export interface MapEntity {
    id: string | number | undefined
    series:
        | ChoroplethSeries
        | {
              value: string
          }
}

export interface ChoroplethSeries extends ChartSeries {
    value: number | string
    time: number
    isSelected?: boolean
    highlightFillColor: Color
}

export interface ChoroplethMapManager {
    choroplethData: Map<SeriesName, ChoroplethSeries>
    choroplethMapBounds: Bounds
    region: MapRegionName
    noDataColor: string
    focusBracket?: MapBracket
    focusEntity?: MapEntity
    onClick: (d: GeoFeature, ev: React.MouseEvent<SVGElement>) => void
    onMapMouseOver: (d: GeoFeature) => void
    onMapMouseLeave: () => void
    isStatic?: boolean
}

export interface RenderFeature {
    id: string
    geo: GeoFeature
    path: string
    bounds: Bounds
    center: PointVector
}

export interface MapChartManager extends ChartManager {
    mapColumnSlug?: ColumnSlug
    mapIsClickable?: boolean
    tab?: GrapherTabConfigOption // Used to switch to chart tab on map click
    type?: GrapherChartType // Used to determine the "Click to select" text in MapTooltip
    hasTimeline?: boolean // Used to determine whether to reset the timeline on map click
    resetHandleTimeBounds?: () => void // Used to reset the timeline on map click
    mapConfig?: MapConfig
    endTime?: Time
    title?: string
}

export interface MapViewport {
    x: number
    y: number
    width: number
    height: number
}

/** Viewport for each region, defined by center and width+height in fractional coordinates */
export const MAP_VIEWPORTS: Record<MapRegionName, MapViewport> = {
    World: {
        x: 0.565,
        y: 0.5,
        width: 1,
        height: 1,
    },
    Europe: {
        x: 0.53,
        y: 0.22,
        width: 0.2,
        height: 0.2,
    },
    Africa: {
        x: 0.49,
        y: 0.7,
        width: 0.21,
        height: 0.38,
    },
    NorthAmerica: {
        x: 0.49,
        y: 0.4,
        width: 0.19,
        height: 0.32,
    },
    SouthAmerica: {
        x: 0.52,
        y: 0.815,
        width: 0.1,
        height: 0.26,
    },
    Asia: {
        x: 0.74,
        y: 0.45,
        width: 0.36,
        height: 0.5,
    },
    Oceania: {
        x: 0.51,
        y: 0.75,
        width: 0.1,
        height: 0.2,
    },
}
