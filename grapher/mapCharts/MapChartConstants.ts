import { ColorScaleBin } from "grapher/color/ColorScaleBin"
import { Bounds } from "grapher/utils/Bounds"
import { PointVector } from "grapher/utils/PointVector"
import { MapProjectionName } from "./MapProjections"
import { ChartManager } from "grapher/chart/ChartManager"
import { MapConfig } from "./MapConfig"
import { Color, ColumnSlug, Time } from "coreTable/CoreTableConstants"
import { SeriesName } from "grapher/core/GrapherConstants"
import { ChartSeries } from "grapher/chart/ChartInterface"

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
    displayValue: string
    time: number
    isSelected?: boolean
    highlightFillColor: Color
}

export interface ChoroplethMapProps {
    choroplethData: Map<SeriesName, ChoroplethSeries>
    bounds: Bounds
    projection: MapProjectionName
    defaultFill: string
    focusBracket?: MapBracket
    focusEntity?: MapEntity
    onClick: (d: GeoFeature, ev: React.MouseEvent<SVGElement>) => void
    onHover: (d: GeoFeature, ev: React.MouseEvent<SVGElement>) => void
    onHoverStop: () => void
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
    mapConfig?: MapConfig
    endTime?: Time
}
