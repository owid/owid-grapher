import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { AbstractColumn } from "owidTable/OwidTable"
import { MapConfig } from "./MapConfig"

export interface MapChartOptionsProvider extends ChartOptionsProvider {
    mapColumn: AbstractColumn
    mapIsClickable?: boolean
    currentTab?: string // Used to switch to chart tab on map click
    mapConfig?: MapConfig
}
