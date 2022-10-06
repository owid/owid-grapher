import { ChartManager } from "../chart/ChartManager.js"
import { CoreValueType, Time } from "@ourworldindata/core-table"
import { ChartSeries } from "../chart/ChartInterface.js"

export interface DiscreteBarSeries extends ChartSeries {
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
