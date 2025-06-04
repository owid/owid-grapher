import { ColorScaleBin } from "../color/ColorScaleBin"
import { Bounds, ColumnSlug } from "@ourworldindata/utils"
import {
    MapRegionName,
    SeriesName,
    InteractionState,
    GlobeRegionName,
    Time,
} from "@ourworldindata/types"
import { ChartManager } from "../chart/ChartManager"
import { MapConfig } from "./MapConfig"
import { ChartSeries } from "../chart/ChartInterface"
import { GlobeController } from "./GlobeController"
import { MapRegionDropdownValue } from "../controls/MapRegionDropdown"
import { MapSelectionArray } from "../selection/MapSelectionArray.js"
import { CoreColumn } from "@ourworldindata/core-table"
import { GrapherInteractionEvent } from "../core/GrapherAnalytics"
import * as R from "remeda"

export declare type SVGMouseEvent = React.MouseEvent<SVGElement>

export type GeoFeature = GeoJSON.Feature<GeoJSON.GeometryObject>
export type MapBracket = ColorScaleBin

export const MAP_HOVER_TARGET_RANGE = 20

export const DEFAULT_STROKE_COLOR = "#333"
export const HOVER_STROKE_COLOR = "#111"

export const DEFAULT_STROKE_WIDTH = 0.3
export const HOVER_STROKE_WIDTH = 1.5
export const SELECTED_STROKE_WIDTH = 1
export const PATTERN_STROKE_WIDTH = 0.7

export const BLUR_FILL_OPACITY = 0.2
export const BLUR_STROKE_OPACITY = 0.5

export const MAP_CHART_CLASSNAME = "MapChart"
export const CHOROPLETH_MAP_CLASSNAME = "ChoroplethMap"
export const GEO_FEATURES_CLASSNAME = "GeoFeatures"

export const DEFAULT_GLOBE_ZOOM = 1
export const GLOBE_MIN_ZOOM = 1
export const GLOBE_MAX_ZOOM = 5
export const GLOBE_COUNTRY_ZOOM = 2.5

export const GLOBE_LATITUDE_MIN = -65
export const GLOBE_LATITUDE_MAX = 65

export const DEFAULT_GLOBE_SIZE = 500 // defined by d3
export const DEFAULT_GLOBE_ROTATION: [number, number] = [-30, 20] // Atlantic ocean (i.e. Americas & Europe)
export const DEFAULT_GLOBE_ROTATIONS_FOR_TIME: Record<
    "UTC_MORNING" | "UTC_MIDDAY" | "UTC_EVENING",
    [number, number]
> = {
    UTC_MORNING: [110, 15], // Asia & Oceania
    UTC_MIDDAY: [20, 20], // Europe & Africa
    UTC_EVENING: [-90, 15], // North & South America
}

export const ANNOTATION_COLOR_DARK = HOVER_STROKE_COLOR
export const ANNOTATION_COLOR_LIGHT = "#fff"

export const ANNOTATION_FONT_SIZE_INTERNAL_DEFAULT = 11
export const ANNOTATION_FONT_SIZE_INTERNAL_MIN = 7
export const ANNOTATION_FONT_SIZE_EXTERNAL_DEFAULT = 8
export const ANNOTATION_FONT_SIZE_EXTERNAL_MAX = 11

export const ANNOTATION_MARKER_LINE_LENGTH_DEFAULT = 6
export const ANNOTATION_MARKER_LINE_LENGTH_MAX = 10

export const MAP_REGION_LABELS: Record<MapRegionName, string> = {
    World: "World",
    Africa: "Africa",
    NorthAmerica: "North America",
    SouthAmerica: "South America",
    Asia: "Asia",
    Europe: "Europe",
    Oceania: "Oceania",
}

export const MAP_REGION_NAMES = R.invert(MAP_REGION_LABELS)

export interface ChoroplethSeries extends ChartSeries {
    value: number | string
    time: number
}

export type ChoroplethSeriesByName = Map<SeriesName, ChoroplethSeries>

export interface ChoroplethMapManager {
    choroplethData: ChoroplethSeriesByName
    choroplethMapBounds: Bounds
    mapConfig: MapConfig
    mapColumn: CoreColumn
    globeController?: GlobeController
    mapRegionDropdownValue?: MapRegionDropdownValue
    resetMapRegionDropdownValue?: () => void
    selectionArray: MapSelectionArray
    fontSize?: number
    getHoverState: (featureId: string) => InteractionState
    isSelected: (featureId: string) => boolean
    onMapMouseOver: (d: GeoFeature) => void
    onMapMouseLeave: () => void
    isMapSelectionEnabled?: boolean
    isStatic?: boolean
}

export enum RenderFeatureType {
    Map = "map",
    Globe = "globe",
}

export interface RenderFeature {
    type: RenderFeatureType
    id: string
    geo: GeoFeature
    geoCentroid: [number, number] // unprojected
    geoBounds: Bounds // unprojected
}

export interface MapRenderFeature extends RenderFeature {
    type: RenderFeatureType.Map
    path: string
    projBounds: Bounds
}

export interface GlobeRenderFeature extends RenderFeature {
    type: RenderFeatureType.Globe
}

export interface MapChartManager extends ChartManager {
    mapColumnSlug?: ColumnSlug
    mapConfig?: MapConfig
    targetTime?: Time
    globeController?: GlobeController
    mapRegionDropdownValue?: MapRegionDropdownValue
    isMapSelectionEnabled?: boolean
    logGrapherInteractionEvent?: (
        action: GrapherInteractionEvent,
        target?: string
    ) => void
}

export interface GlobeViewport {
    rotation: [number, number]
    zoom: number
}

export interface MapViewport {
    x: number
    y: number
    width: number
    height: number
}

export const GLOBE_VIEWPORTS: Record<GlobeRegionName, GlobeViewport> = {
    Europe: { rotation: [10, 55], zoom: 2.95 },
    Africa: { rotation: [20, 0], zoom: 1.55 },
    NorthAmerica: { rotation: [-94.5, 43], zoom: 1.5 },
    SouthAmerica: { rotation: [-62, -22], zoom: 1.75 },
    Asia: { rotation: [81, 26], zoom: 1.85 },
    Oceania: { rotation: [152.65, -18.8], zoom: 2 },
}

/** Viewport for each region, defined by center and width+height in fractional coordinates */
export const MAP_VIEWPORTS: Record<MapRegionName, MapViewport> = {
    World: { x: 0.565, y: 0.5, width: 1, height: 1 },
    Europe: { x: 0.53, y: 0.22, width: 0.2, height: 0.2 },
    Africa: { x: 0.49, y: 0.7, width: 0.21, height: 0.38 },
    NorthAmerica: { x: 0.49, y: 0.4, width: 0.19, height: 0.32 },
    SouthAmerica: { x: 0.52, y: 0.815, width: 0.1, height: 0.26 },
    Asia: { x: 0.74, y: 0.45, width: 0.36, height: 0.5 },
    Oceania: { x: 0.51, y: 0.75, width: 0.1, height: 0.2 },
}

export interface Circle {
    cx: number // center x
    cy: number // center y
    r: number // radius
}

export interface Ellipse {
    cx: number // center x
    cy: number // center y
    rx: number // radius on the x-axis
    ry: number // radius on the y-axis
}

// ellipse expressed in lon/lat
export interface EllipseCoords {
    cx: number
    cy: number
    left: number // left x
    top: number // top y
}

interface BaseAnnotation {
    id: string
    feature: RenderFeature
    placedBounds: Bounds
    text: string
    fontSize: number
    color: string
}

export interface InternalAnnotation extends BaseAnnotation {
    type: "internal"
    ellipse: Ellipse
}

export interface ExternalAnnotation extends BaseAnnotation {
    type: "external"
    direction: Direction
    anchor: [number, number]
}

export type Annotation = InternalAnnotation | ExternalAnnotation

export type Direction =
    | "left"
    | "right"
    | "top"
    | "bottom"
    | "leftTop"
    | "leftBottom"
    | "rightTop"
    | "rightBottom"
