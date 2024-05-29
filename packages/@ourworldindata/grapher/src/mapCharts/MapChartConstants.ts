import { ColorScaleBin } from "../color/ColorScaleBin"
import { Bounds, PointVector, ColumnSlug } from "@ourworldindata/utils"
import {
    MapProjectionName,
    Color,
    Time,
    ChartTypeName,
    GrapherTabOption,
    SeriesName,
} from "@ourworldindata/types"
import { ChartManager } from "../chart/ChartManager"
import { MapConfig } from "./MapConfig"
import { ChartSeries } from "../chart/ChartInterface"
import { GlobeController } from "./GlobeController"

export type GeoFeature = GeoJSON.Feature<GeoJSON.GeometryObject>
export type MapBracket = ColorScaleBin
export const MAP_HOVER_TARGET_RANGE = 20

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
    isGlobe: boolean
    choroplethData: Map<SeriesName, ChoroplethSeries>
    choroplethMapBounds: Bounds
    projection: MapProjectionName
    noDataColor: string
    focusBracket?: MapBracket
    focusEntity?: MapEntity
    onClickFeature: (d: GeoFeature, ev: React.MouseEvent<SVGElement>) => void
    onMapMouseOver: (d: GeoFeature) => void
    onMapMouseLeave: () => void
    onProjectionChange: (projection: MapProjectionName) => void
    clearProjection: () => void
    strokeWidth?: number
    globeRotation: [number, number]
    globeController: GlobeController
    onGlobeRotationChange: (rotate: [number, number]) => void
    fontSize?: number
}

export interface RenderFeature {
    id: string
    geo: GeoFeature
    geoCentroid: PointVector // unprojected centroid
    path: string
    bounds: Bounds
    center: PointVector
}

export interface MapChartManager extends ChartManager {
    isGlobe?: boolean
    mapColumnSlug?: ColumnSlug
    mapIsClickable?: boolean
    tab?: GrapherTabOption // Used to switch to chart tab on map click
    type?: ChartTypeName // Used to determine the "Click to select" text in MapTooltip
    isLineChartThatTurnedIntoDiscreteBar?: boolean // Used to determine whether to reset the timeline on map click
    hasTimeline?: boolean // Used to determine whether to reset the timeline on map click
    resetHandleTimeBounds?: () => void // Used to reset the timeline on map click
    mapConfig?: MapConfig
    endTime?: Time
    title?: string
    isModalOpen?: boolean
    globeRotation?: [number, number]
    globeController?: GlobeController
}

export interface Viewport {
    x: number
    y: number
    width: number
    height: number
    rotation: [number, number]
}

// Viewport for each projection, defined by center and width+height in fractional coordinates
export const VIEWPORTS: Record<MapProjectionName, Viewport> = {
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

export const DEFAULT_VIEWPORT = VIEWPORTS.World

export const DEFAULT_ROTATIONS: Record<
    "UTC_MORNING" | "UTC_MIDDAY" | "UTC_EVENING",
    [number, number]
> = {
    UTC_MORNING: [-110, -15], // Asia & Oceania
    UTC_MIDDAY: [-20, -20], // Europe & Africa
    UTC_EVENING: [90, -15], // North & South America
}
