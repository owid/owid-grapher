import { ChartManager } from "../chart/ChartManager"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"
import { CoreValueType, Time } from "@ourworldindata/types"
import { TextWrap } from "@ourworldindata/components"

export interface DiscreteBarSeries extends ChartSeries {
    entityName: string
    shortEntityName?: string
    yColumn: CoreColumn
    value: number
    time: Time
    colorValue?: CoreValueType
    label?: TextWrap
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
    isOnLineChartTab?: boolean
}

export const BACKGROUND_COLOR = "#fff"
