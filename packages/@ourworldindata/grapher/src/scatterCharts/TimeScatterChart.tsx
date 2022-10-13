import { observer } from "mobx-react"
import { Bounds } from "@ourworldindata/utils"
import { ScatterPlotChart } from "./ScatterPlotChart"
import { ScatterPlotManager } from "./ScatterPlotChartConstants"

// todo: readd
@observer
export class TimeScatterChart extends ScatterPlotChart {
    constructor(props: { bounds?: Bounds; manager: ScatterPlotManager }) {
        super(props)
    }
}
