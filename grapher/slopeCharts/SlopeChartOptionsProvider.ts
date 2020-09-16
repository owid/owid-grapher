import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { AddCountryMode } from "grapher/core/GrapherConstants"
import { SlopeChartTransform } from "./SlopeChartTransform"

export interface SlopeChartOptionsProvider extends ChartOptionsProvider {
    slopeChartTransform: SlopeChartTransform
    yAxis: AxisConfig // just pass interface?
    addCountryMode: AddCountryMode
}
