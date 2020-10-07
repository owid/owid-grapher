import { SeriesName } from "grapher/core/GrapherConstants"

// The idea of this interface is to try and start reusing more code across our Chart classes and make it easier
// for a dev to work on a chart type they haven't touched before if they've worked with another that implements
// this interface.

interface ChartSeries {
    seriesName: SeriesName
}

export interface ChartInterface {
    series: ChartSeries[]
    failMessage: string
}
