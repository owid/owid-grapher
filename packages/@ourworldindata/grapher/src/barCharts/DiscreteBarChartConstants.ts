import { ChartManager } from "../chart/ChartManager"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"
import {
    Color,
    CoreValueType,
    InteractionState,
    Time,
} from "@ourworldindata/types"
import { TextWrap } from "@ourworldindata/components"

export interface DiscreteBarSeries extends ChartSeries {
    entityName: string
    shortEntityName?: string
    yColumn: CoreColumn
    value: number
    time: Time
    colorValue?: CoreValueType
    label?: TextWrap
    focus: InteractionState
}

export interface PlacedDiscreteBarSeries extends DiscreteBarSeries {
    // data bar
    barX: number
    barY: number
    barWidth: number

    // entity and value labels
    entityLabelX: number
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
