import { ChartSeries } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { ChartTypeName } from "../core/GrapherConstants"
import { Bounds } from "../../clientUtils/Bounds"

export interface FacetChartProps {
    readonly bounds?: Bounds
    readonly chartTypeName?: ChartTypeName
    readonly manager: ChartManager
}

export interface FacetSeries extends ChartSeries {
    readonly manager: Partial<ChartManager>
    readonly chartTypeName?: ChartTypeName
}

export interface PlacedFacetSeries extends FacetSeries {
    readonly manager: ChartManager
    readonly chartTypeName: ChartTypeName
    readonly bounds: Bounds
}
