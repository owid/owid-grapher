import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import {
    AddCountryMode,
    EntityDimensionKey,
} from "grapher/core/GrapherConstants"
import { SlopeChartTransform } from "./SlopeChartTransform"

export interface SlopeChartOptionsProvider extends ChartOptionsProvider {
    slopeChartTransform: SlopeChartTransform
    toggleKey: (key: EntityDimensionKey) => void
    selectedKeys: EntityDimensionKey[]
    yAxis: AxisConfig // just pass interface?
    addCountryMode: AddCountryMode
}
