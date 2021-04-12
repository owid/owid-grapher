import { ChartManager } from "../chart/ChartManager"
import { Time } from "../../coreTable/CoreTableConstants"
import { ChartSeries } from "../chart/ChartInterface"

export interface DiscreteBarSeries extends ChartSeries {
    readonly value: number
    readonly time: Time
}

export interface DiscreteBarChartManager extends ChartManager {
    readonly showYearLabels?: boolean
    readonly endTime?: Time
    readonly isLineChart?: boolean
}

export const DEFAULT_BAR_COLOR = "#2E5778"
