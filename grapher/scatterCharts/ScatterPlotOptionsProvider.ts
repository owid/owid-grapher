import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import {
    AddCountryMode,
    ScatterPointLabelStrategy,
} from "grapher/core/GrapherConstants"
import { ScatterTransform } from "./ScatterTransform"

export interface ScatterPlotOptionsProvider extends ChartOptionsProvider {
    scatterTransform: ScatterTransform
    hideConnectedScatterLines?: boolean
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    addCountryMode: AddCountryMode
}
