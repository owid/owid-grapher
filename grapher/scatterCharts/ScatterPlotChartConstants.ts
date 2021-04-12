import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { Color, Time } from "../../coreTable/CoreTableConstants"
import { DualAxis } from "../axis/Axis"
import { ChartManager } from "../chart/ChartManager"
import { NoDataModalManager } from "../noDataModal/NoDataModal"
import { ColorScale } from "../color/ColorScale"
import {
    ScatterPointLabelStrategy,
    EntitySelectionMode,
    SeriesName,
} from "../core/GrapherConstants"

import { Bounds } from "../../clientUtils/Bounds"
import { PointVector } from "../../clientUtils/PointVector"
import { EntityId, EntityName } from "../../coreTable/OwidTableConstants"
import { ChartSeries } from "../chart/ChartInterface"
import { OwidTable } from "../../coreTable/OwidTable"

export interface ScatterPlotManager extends ChartManager {
    readonly hideConnectedScatterLines?: boolean
    readonly scatterPointLabelStrategy?: ScatterPointLabelStrategy
    readonly addCountryMode?: EntitySelectionMode
    readonly xOverrideTime?: Time | undefined
    readonly tableAfterAuthorTimelineAndActiveChartTransformAndPopulationFilter?: OwidTable
    readonly excludedEntities?: readonly EntityId[]
    readonly backgroundSeriesLimit?: number
    readonly hideLinesOutsideTolerance?: boolean
    readonly startTime?: Time
    readonly endTime?: Time
    readonly hasTimeline?: boolean
}

export interface ScatterTooltipProps {
    readonly yColumn: CoreColumn
    readonly xColumn: CoreColumn
    readonly series: ScatterSeries
    readonly maxWidth: number
    readonly fontSize: number
    readonly x: number
    readonly y: number
}

export interface ScatterSeries extends ChartSeries {
    readonly label: string
    readonly size: number
    readonly points: readonly SeriesPoint[]
    readonly isScaleColor?: boolean
}

export interface SeriesPoint {
    readonly x: number
    readonly y: number
    readonly size: number
    readonly entityName?: EntityName
    readonly label: string
    readonly color?: number | Color
    readonly timeValue: Time
    readonly time: {
        readonly x: number
        readonly y: number
        readonly span?: [number, number]
    }
}

export interface ScatterRenderPoint {
    readonly position: PointVector
    readonly color: Color
    readonly size: number
    readonly fontSize: number
    readonly label: string
    readonly time: {
        x: number
        y: number
    }
}

export const ScatterLabelFontFamily = "Arial, sans-serif"

export interface ScatterRenderSeries extends ChartSeries {
    readonly displayKey: string
    readonly size: number
    readonly points: readonly ScatterRenderPoint[]
    readonly text: string
    readonly isHover?: boolean
    readonly isFocus?: boolean
    readonly isForeground?: boolean
    readonly startLabel?: ScatterLabel
    readonly midLabels: readonly ScatterLabel[]
    readonly endLabel?: ScatterLabel
    readonly allLabels: readonly ScatterLabel[]
    offsetVector: PointVector
}

export interface ScatterLabel {
    readonly text: string
    readonly fontSize: number
    readonly fontWeight: number
    readonly color: Color
    readonly series: ScatterRenderSeries
    readonly isStart?: boolean
    readonly isMid?: boolean
    readonly isEnd?: boolean
    bounds: Bounds
    isHidden?: boolean
}

export interface ScatterPointsWithLabelsProps {
    readonly seriesArray: readonly ScatterSeries[]
    readonly hoveredSeriesNames: readonly SeriesName[]
    readonly focusedSeriesNames: readonly SeriesName[]
    readonly dualAxis: DualAxis
    readonly colorScale?: ColorScale
    readonly sizeDomain: [number, number]
    readonly onMouseOver: (series: ScatterSeries) => void
    readonly onMouseLeave: () => void
    readonly onClick: () => void
    readonly hideConnectedScatterLines: boolean
    readonly noDataModalManager: NoDataModalManager
}
