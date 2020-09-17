import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { AddCountryMode } from "grapher/core/GrapherConstants"

export interface SlopeChartOptionsProvider extends ChartOptionsProvider {
    yAxis?: AxisConfig // just pass interface?
    addCountryMode: AddCountryMode
}
