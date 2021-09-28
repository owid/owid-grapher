import { ChartSeries } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { ChartTypeName } from "../core/GrapherConstants"
import { Bounds } from "../../clientUtils/Bounds"

export interface FacetChartProps {
    bounds?: Bounds
    chartTypeName?: ChartTypeName
    manager: ChartManager
}

export interface FacetSeries extends ChartSeries {
    manager: Partial<ChartManager>
    chartTypeName?: ChartTypeName
}

export interface PlacedFacetSeries extends FacetSeries {
    manager: ChartManager
    chartTypeName: ChartTypeName
    bounds: Bounds
    contentBounds: Bounds
}
