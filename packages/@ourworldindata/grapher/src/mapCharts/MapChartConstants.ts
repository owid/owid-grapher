import { ColorScaleBin } from "../color/ColorScaleBin"
import { Bounds, ColumnSlug } from "@ourworldindata/utils"
import {
    MapRegionName,
    SeriesName,
    InteractionState,
    GlobeRegionName,
} from "@ourworldindata/types"
import { ChartManager } from "../chart/ChartManager"
import { MapConfig } from "./MapConfig"
import { ChartSeries } from "../chart/ChartInterface"
import { GlobeController } from "./GlobeController"
import { SelectionArray } from "../selection/SelectionArray"
import { CoreColumn } from "@ourworldindata/core-table"

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

export const GLOBE_MIN_ZOOM = 1
export const GLOBE_MAX_ZOOM = 5
export const GLOBE_COUNTRY_ZOOM = 2.5
export const DEFAULT_GLOBE_ROTATION: [number, number] = [30, -20] // Atlantic ocean (i.e. Americas & Europe)
export const DEFAULT_GLOBE_SIZE = 500 // defined by d3

export const ANNOTATION_FONT_SIZE_DEFAULT = 11
export const ANNOTATION_FONT_SIZE_MIN = 7
export const ANNOTATION_MARKER_LINE_LENGTH_DEFAULT = 4
export const ANNOTATION_MARKER_LINE_LENGTH_MAX = 8

export const MAP_REGION_LABELS: Record<MapRegionName, string> = {
    World: "World",
    Africa: "Africa",
    NorthAmerica: "North America",
    SouthAmerica: "South America",
    Asia: "Asia",
    Europe: "Europe",
    Oceania: "Oceania",
}

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
    selectionArray: SelectionArray
    fontSize?: number
    getHoverState: (featureId: string) => InteractionState
    isSelected: (featureId: string) => boolean
    onMapMouseOver: (d: GeoFeature) => void
    onMapMouseLeave: () => void
    shouldShowEntitySelectorOnMapTab?: boolean
    shouldEnableEntitySelectionOnMapTab?: boolean
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
    globeController?: GlobeController
    shouldShowEntitySelectorOnMapTab?: boolean
    shouldEnableEntitySelectionOnMapTab?: boolean
}

export interface GlobeViewport {
    rotation: [number, number]
    zoom: number
}

export const GLOBE_VIEWPORTS: Record<GlobeRegionName, GlobeViewport> = {
    Europe: { rotation: [-10, -55], zoom: 3 },
    Africa: { rotation: [-20, 0], zoom: 1.65 },
    NorthAmerica: { rotation: [95, -48], zoom: 1.5 },
    SouthAmerica: { rotation: [62, 22], zoom: 1.75 },
    Asia: { rotation: [-81, -26], zoom: 1.85 },
    Oceania: { rotation: [-153, 25], zoom: 2 },
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

// when expressed in lon/lat
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
