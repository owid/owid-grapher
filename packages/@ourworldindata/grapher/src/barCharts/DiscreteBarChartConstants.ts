import { ChartManager } from "../chart/ChartManager"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"
import { Color, CoreValueType, Time } from "@ourworldindata/types"
import { TextWrap } from "@ourworldindata/components"
import { InteractionState } from "../interaction/InteractionState.js"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState.js"

export interface DiscreteBarSeries extends ChartSeries {
    entityName: string
    shortEntityName?: string
    yColumn: CoreColumn
    value: number
    time: Time
    colorValue?: CoreValueType
    annotation?: string
    focus: InteractionState
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

export interface DiscreteBarChartManager extends ChartManager {
    showYearLabels?: boolean
    endTime?: Time
    hasLineChart?: boolean // used to pick color scheme
    hasSlopeChart?: boolean // used to pick color scheme
}

export interface DiscreteBarItem {
    yColumn: CoreColumn
    seriesName: string
    value: number
    time: number
    colorValue?: CoreValueType
    color?: Color
}

export const BACKGROUND_COLOR = "#fff"
export const BAR_SPACING_FACTOR = 0.35
