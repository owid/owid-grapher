import { ChartManager } from "../chart/ChartManager"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"
import {
    Color,
    CoreValueType,
    ProjectionColumnInfo,
    Time,
} from "@ourworldindata/types"
import { TextWrap } from "@ourworldindata/components"
import { InteractionState } from "../interaction/InteractionState.js"
import { ColumnSlug } from "@ourworldindata/utils"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"
import { Emphasis } from "../interaction/Emphasis.js"
import {
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AREA_OPACITY_HIGHLIGHTED,
    GRAPHER_AREA_OPACITY_MUTED,
} from "../core/GrapherConstants"

export interface DiscreteBarSeries extends ChartSeries {
    entityName: string
    shortEntityName?: string
    yColumn: CoreColumn
    value: number
    time: Time
    colorValue?: CoreValueType
    annotation?: string
    focus: InteractionState
    isProjection?: boolean
}

export interface SizedDiscreteBarSeries extends DiscreteBarSeries {
    label: SeriesLabelState
    annotationTextWrap?: TextWrap
}

export interface PlacedDiscreteBarSeries extends SizedDiscreteBarSeries {
    // data bar
    barX: number
    barY: number
    barWidth: number

    // entity label, annotation, and value label positions
    entityLabelX: number
    entityLabelY: number
    annotationY?: number
    valueLabelX: number
}

export interface RenderDiscreteBarSeries extends PlacedDiscreteBarSeries {
    emphasis: Emphasis
}

interface DiscreteBarStyle {
    barOpacity: number
    labelOpacity: number
}

export const DISCRETE_BAR_STYLE: Record<Emphasis, DiscreteBarStyle> = {
    [Emphasis.Default]: {
        barOpacity: GRAPHER_AREA_OPACITY_DEFAULT,
        labelOpacity: 1,
    },
    [Emphasis.Highlighted]: {
        barOpacity: GRAPHER_AREA_OPACITY_HIGHLIGHTED,
        labelOpacity: 1,
    },
    [Emphasis.Muted]: {
        barOpacity: GRAPHER_AREA_OPACITY_MUTED,
        labelOpacity: 0.3,
    },
}

export interface DiscreteBarChartManager extends ChartManager {
    showYearLabels?: boolean
    endTime?: Time
    hasLineChart?: boolean // used to pick color scheme
    hasSlopeChart?: boolean // used to pick color scheme
    projectionColumnInfoBySlug?: Map<ColumnSlug, ProjectionColumnInfo>
}

export interface DiscreteBarItem {
    yColumn: CoreColumn
    seriesName: string
    value: number
    time: number
    colorValue?: CoreValueType
    color?: Color
    isProjection?: boolean
}

/**
 * Describes how Y columns are handled.
 *
 * - "independent": Each Y column is treated independently and plotted as its own series.
 * - "combined": A historical and projection column pair are merged into a single
 *   series, with projections indicated appropriately.
 */
export type YColumnMode =
    | { type: "independent"; slugs: ColumnSlug[] }
    | { type: "combined"; slugs: ColumnSlug[]; info: ProjectionColumnInfo }

export const BAR_SPACING_FACTOR = 0.35
