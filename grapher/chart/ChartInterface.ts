import { SeriesName } from "grapher/core/GrapherConstants"

interface ChartSeries {
    seriesName: SeriesName
}

export interface ChartInterface {
    series: ChartSeries[]
    failMessage: string
}
