import { ColorScaleBin } from "../color/ColorScaleBin"
import { Bounds, PointVector, ColumnSlug } from "@ourworldindata/utils"
import {
    MapRegionName,
    Color,
    Time,
    GrapherChartType,
    GrapherTabOption,
    SeriesName,
} from "@ourworldindata/types"
import { ChartManager } from "../chart/ChartManager"
import { MapConfig } from "./MapConfig"
import { ChartSeries } from "../chart/ChartInterface"
import { GlobeController } from "./GlobeController"

export declare type SVGMouseEvent = React.MouseEvent<SVGElement>

export type GeoFeature = GeoJSON.Feature<GeoJSON.GeometryObject>
export type MapBracket = ColorScaleBin

export const MAP_HOVER_TARGET_RANGE = 20

export const DEFAULT_STROKE_COLOR = "#333"
export const FOCUS_STROKE_COLOR = "#111"

export const DEFAULT_STROKE_WIDTH = 0.3
export const FOCUS_STROKE_WIDTH = 1.5
export const SELECTED_STROKE_WIDTH = 1
export const PATTERN_STROKE_WIDTH = 0.7

export const BLUR_FILL_OPACITY = 0.2
export const BLUR_STROKE_OPACITY = 0.5

export const MAP_CHART_CLASSNAME = "MapChart"
export const CHOROPLETH_MAP_CLASSNAME = "ChoroplethMap"
export const GEO_FEATURES_CLASSNAME = "GeoFeatures"

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

export type ChoroplethSeriesByName = Map<SeriesName, ChoroplethSeries>

export interface ChoroplethMapManager {
    choroplethData: ChoroplethSeriesByName
    choroplethMapBounds: Bounds
    mapConfig: MapConfig
    focusBracket?: MapBracket
    focusEntity?: MapEntity
    onClick: (d: GeoFeature, ev: MouseEvent) => void
    onMapMouseOver: (d: GeoFeature) => void
    onMapMouseLeave: () => void
    isStatic?: boolean
}

export interface ChoroplethGlobeManager extends ChoroplethMapManager {
    globeController: GlobeController
}

export enum RenderFeatureType {
    Map = "map",
    Globe = "globe",
}

export interface RenderFeature {
    type: RenderFeatureType
    id: string
    geo: GeoFeature
}

export interface MapRenderFeature extends RenderFeature {
    type: RenderFeatureType.Map
    path: string
    bounds: Bounds
    center: PointVector
}

export interface GlobeRenderFeature extends RenderFeature {
    type: RenderFeatureType.Globe
    centroid: [number, number]
}

export interface MapChartManager extends ChartManager {
    mapColumnSlug?: ColumnSlug
    mapIsClickable?: boolean
    tab?: GrapherTabOption // Used to switch to chart tab on map click
    type?: GrapherChartType // Used to determine the "Click to select" text in MapTooltip
    isLineChartThatTurnedIntoDiscreteBar?: boolean // Used to determine whether to reset the timeline on map click
    hasTimeline?: boolean // Used to determine whether to reset the timeline on map click
    resetHandleTimeBounds?: () => void // Used to reset the timeline on map click
    mapConfig?: MapConfig
    endTime?: Time
    title?: string
    globeController: GlobeController
}

export interface MapViewport {
    // map
    x: number
    y: number
    width: number
    height: number

    // globe
    rotation: [number, number]
}

/** Viewport for each region, defined by center and width+height in fractional coordinates */
export const MAP_VIEWPORTS: Record<MapRegionName, MapViewport> = {
    World: {
        x: 0.565,
        y: 0.5,
        width: 1,
        height: 1,
        rotation: [30, -20], // Atlantic ocean (i.e. Americas & Europe)
    },
    Europe: {
        x: 0.53,
        y: 0.22,
        width: 0.2,
        height: 0.2,
        rotation: [-10, -50],
    },
    Africa: {
        x: 0.49,
        y: 0.7,
        width: 0.21,
        height: 0.38,
        rotation: [-20, 0],
    },
    NorthAmerica: {
        x: 0.49,
        y: 0.4,
        width: 0.19,
        height: 0.32,
        rotation: [110, -40],
    },
    SouthAmerica: {
        x: 0.52,
        y: 0.815,
        width: 0.1,
        height: 0.26,
        rotation: [60, 20],
    },
    Asia: {
        x: 0.74,
        y: 0.45,
        width: 0.36,
        height: 0.5,
        rotation: [-100, -35],
    },
    Oceania: {
        x: 0.51,
        y: 0.75,
        width: 0.1,
        height: 0.2,
        rotation: [-140, 20],
    },
}

export const DEFAULT_VIEWPORT = MAP_VIEWPORTS.World
