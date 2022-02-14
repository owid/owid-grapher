import { ChartSeries } from "../chart/ChartInterface.js"
import { ChartManager } from "../chart/ChartManager.js"
import { ChartTypeName } from "../core/GrapherConstants.js"
import { Bounds } from "../../clientUtils/Bounds.js"

export interface FacetChartManager extends ChartManager {
    canSelectMultipleEntities?: boolean
}

export interface FacetChartProps {
    bounds?: Bounds
    chartTypeName?: ChartTypeName
    manager: FacetChartManager
}

export interface FacetSeries extends ChartSeries {
    manager: Partial<ChartManager>
}

export interface PlacedFacetSeries extends FacetSeries {
    manager: ChartManager
    bounds: Bounds
    contentBounds: Bounds
}
