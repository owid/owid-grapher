import { ChartManager } from "../chart/ChartManager"
import { CoreValueType, Time } from "../../coreTable/CoreTableConstants"
import { ChartSeries } from "../chart/ChartInterface"

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

export const DEFAULT_BAR_COLOR = "#2E5778"
export const BACKGROUND_COLOR = "#fff"
