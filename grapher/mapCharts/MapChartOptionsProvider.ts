import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { AbstractCoreColumn } from "coreTable/CoreTable"
import { MapConfig } from "./MapConfig"

export interface MapChartOptionsProvider extends ChartOptionsProvider {
    mapColumn: AbstractCoreColumn
    mapIsClickable?: boolean
    currentTab?: string // Used to switch to chart tab on map click
    mapConfig?: MapConfig
}
