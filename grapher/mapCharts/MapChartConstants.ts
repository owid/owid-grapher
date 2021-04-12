import { ColorScaleBin } from "../color/ColorScaleBin"
import { Bounds } from "../../clientUtils/Bounds"
import { PointVector } from "../../clientUtils/PointVector"
import { MapProjectionName } from "./MapProjections"
import { ChartManager } from "../chart/ChartManager"
import { MapConfig } from "./MapConfig"
import { Color, ColumnSlug, Time } from "../../coreTable/CoreTableConstants"
import { ChartTypeName, SeriesName } from "../core/GrapherConstants"
import { ChartSeries } from "../chart/ChartInterface"

export type GeoFeature = GeoJSON.Feature<GeoJSON.GeometryObject>
export type MapBracket = ColorScaleBin

export interface MapEntity {
    readonly id: string | number | undefined
    readonly series:
        | ChoroplethSeries
        | {
              value: string
          }
}

export interface ChoroplethSeries extends ChartSeries {
    readonly value: number | string
    readonly displayValue: string
    readonly time: number
    readonly isSelected?: boolean
    readonly highlightFillColor: Color
}

export interface ChoroplethMapProps {
    readonly choroplethData: Map<SeriesName, ChoroplethSeries>
    readonly bounds: Bounds
    readonly projection: MapProjectionName
    readonly defaultFill: string
    readonly focusBracket?: MapBracket
    readonly focusEntity?: MapEntity
    readonly onClick: (d: GeoFeature, ev: React.MouseEvent<SVGElement>) => void
    readonly onHover: (d: GeoFeature, ev: React.MouseEvent<SVGElement>) => void
    readonly onHoverStop: () => void
}

export interface RenderFeature {
    readonly id: string
    readonly geo: GeoFeature
    readonly path: string
    readonly bounds: Bounds
    readonly center: PointVector
}

export interface MapChartManager extends ChartManager {
    readonly mapColumnSlug?: ColumnSlug
    readonly mapIsClickable?: boolean
    readonly type?: ChartTypeName // Used to determine the "Click to select" text in MapTooltip
    readonly mapConfig?: MapConfig
    readonly endTime?: Time
    currentTab?: string // Used to switch to chart tab on map click
}
