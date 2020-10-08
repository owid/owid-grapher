import { ChartManager } from "grapher/chart/ChartManager"
import { ChartTypeName, SeriesName } from "grapher/core/GrapherConstants"
import { Bounds } from "grapher/utils/Bounds"

export interface FacetChartProps {
    bounds?: Bounds
    chartTypeName?: ChartTypeName
    manager: ChartManager
}

export interface FacetSeries {
    seriesName: SeriesName
    manager: Partial<ChartManager>
    chartTypeName?: ChartTypeName
}

export interface PlacedFacetSeries extends FacetSeries {
    manager: ChartManager
    chartTypeName: ChartTypeName
    bounds: Bounds
}
