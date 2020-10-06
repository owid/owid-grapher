import { ChartManager } from "grapher/chart/ChartManager"
import { Time, Color, SeriesName } from "grapher/core/GrapherConstants"

export interface DiscreteBarDatum {
    seriesName: SeriesName
    value: number
    time: Time
    label: string
    color: Color
}

export interface DiscreteBarChartManager extends ChartManager {
    showYearLabels?: boolean
}
