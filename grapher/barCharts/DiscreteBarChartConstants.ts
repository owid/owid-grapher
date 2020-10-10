import { ChartManager } from "grapher/chart/ChartManager"
import { SeriesName } from "grapher/core/GrapherConstants"
import { Color, Time } from "coreTable/CoreTableConstants"

export interface DiscreteBarSeries {
    seriesName: SeriesName
    value: number
    time: Time
    label: string
    color: Color
}

export interface DiscreteBarChartManager extends ChartManager {
    showYearLabels?: boolean
}
