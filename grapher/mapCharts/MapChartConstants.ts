import { ColorScaleBin } from "../color/ColorScaleBin.js"
import { Bounds } from "../../clientUtils/Bounds.js"
import { PointVector } from "../../clientUtils/PointVector.js"
import { MapProjectionName } from "./MapProjections.js"
import { ChartManager } from "../chart/ChartManager.js"
import { MapConfig } from "./MapConfig.js"
import { Color, Time } from "../../coreTable/CoreTableConstants.js"
import { ChartTypeName, SeriesName } from "../core/GrapherConstants.js"
import { ChartSeries } from "../chart/ChartInterface.js"
import { ColumnSlug } from "../../clientUtils/owidTypes.js"
import { Position } from "geojson"

export type GeoFeature = GeoJSON.Feature<GeoJSON.GeometryObject>
export type MapBracket = ColorScaleBin

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
    shortValue?: number | string
}

export interface ChoroplethMapManager {
    choroplethData: Map<SeriesName, ChoroplethSeries>
    choroplethMapBounds: Bounds
    projection: MapProjectionName
    noDataColor: string
    focusBracket?: MapBracket
    focusEntity?: MapEntity
    onClick: (d: GeoFeature, ev: React.MouseEvent<SVGElement>) => void
    onMapMouseOver: (d: GeoFeature, ev: React.MouseEvent<SVGElement>) => void
    onMapMouseLeave: () => void
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
    currentTab?: string // Used to switch to chart tab on map click
    type?: ChartTypeName // Used to determine the "Click to select" text in MapTooltip
    mapConfig?: MapConfig
    endTime?: Time
}

export enum ExternalDirections {
    right = "right",
    left = "left",
    topRight = "topRight",
    bottomRight = "bottomRight",
    topLeft = "topLeft",
    bottomLeft = "bottomLeft",
    bottom = "bottom",
    top = "top",
}

export interface Annotation {
    id: string
    position: PointVector
    value: any
    size: number
    type: "internal" | "external"
    pole: Position
    marker?: Position[]
    anchor?: boolean
}

// AnnotationsCache has the following data:
// externalCandidates: Cache of all possible starting points of markers for external annotations
//                     and their associated directions
// candidateInfo: Cache of positional info of a candidate point for external annotation and its
//                feasibility
// regions: Cache of all distinct polygons (regions) of a country
// internalInfo: Cache of the calculated poles of inaccessibility for internal annotations and the
//               associated regional polygon for that country
// allPoints: Dictionary of all countries' points on a map and the count of the coordinate's occurrence.
//            Occurrence > 1 implies the point is shared by 2 or more nations
// viewportScale: The viewportScale value. Used to invalidate cache and recalculate if viewport changes
export interface AnnotationsCache {
    externalCandidates: ExternalCandidates[]
    candidateInfo: CandidateInfo[]
    regions: Region[]
    internalInfo: InternalInfo[]
    allPoints: Record<string, number>
    viewportScale: number
}

export interface InternalInfo {
    pole: number[]
    points: Position[]
    id: string
}

export interface ExternalCandidates {
    positions: { direction: ExternalDirections; point: Position }[]
    id: string
}

export interface CandidateInfo {
    id: string
    boundaryPosition: Position
    direction: ExternalDirections
    textWidth: number
    possible: boolean
    labelPosition?: Position
    marker?: Position[]
    anchor?: boolean
}

export interface Region {
    id: string
    points: Position[]
}
export const MIN_INTERNAL_ANNOTATION_SIZE = 8
export const MAX_INTERNAL_ANNOTATION_SIZE = 14
export const EXTERNAL_ANNOTATION_SIZE = 11
export const ANNOTATION_TEXT_COLOR = "#444445"
export const ANNOTATION_LINE_COLOR = "#303030"
