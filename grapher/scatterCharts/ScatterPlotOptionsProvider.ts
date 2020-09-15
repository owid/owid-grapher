import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import {
    EntityDimensionKey,
    ScatterPointLabelStrategy,
} from "grapher/core/GrapherConstants"
import { ScatterTransform } from "./ScatterTransform"

export interface ScatterPlotOptionsProvider extends ChartOptionsProvider {
    scatterTransform: ScatterTransform
    toggleKey: (key: EntityDimensionKey) => void
    selectedKeys: EntityDimensionKey[]
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
}
