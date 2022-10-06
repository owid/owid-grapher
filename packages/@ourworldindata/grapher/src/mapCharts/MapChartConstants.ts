import { ColorScaleBin } from "../color/ColorScaleBin.js"
import { Bounds, PointVector, ColumnSlug } from "@ourworldindata/utils"
import { MapProjectionName } from "./MapProjections.js"
import { ChartManager } from "../chart/ChartManager.js"
import { MapConfig } from "./MapConfig.js"
import { Color, Time } from "@ourworldindata/core-table"
import { ChartTypeName, SeriesName } from "../core/GrapherConstants.js"
import { ChartSeries } from "../chart/ChartInterface.js"

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
