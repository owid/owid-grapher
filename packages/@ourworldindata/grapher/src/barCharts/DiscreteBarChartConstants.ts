import { ChartManager } from "../chart/ChartManager"
import { CoreColumn } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"
import { CoreValueType, Time } from "@ourworldindata/types"

export interface DiscreteBarSeries extends ChartSeries {
    yColumn: CoreColumn
    value: number
    time: Time
    colorValue?: CoreValueType
}

export interface DiscreteBarChartManager extends ChartManager {
    showYearLabels?: boolean
    endTime?: Time
    isLineChart?: boolean
}

export const BACKGROUND_COLOR = "#fff"
