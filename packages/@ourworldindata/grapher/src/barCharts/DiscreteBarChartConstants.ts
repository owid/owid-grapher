import { ChartManager } from "../chart/ChartManager"
import { CoreColumn, CoreValueType, Time } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface"

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
