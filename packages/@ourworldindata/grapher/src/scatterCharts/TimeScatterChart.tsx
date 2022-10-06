import { observer } from "mobx-react"
import { Bounds } from "@ourworldindata/utils"
import { ScatterPlotChart } from "./ScatterPlotChart.js"
import { ScatterPlotManager } from "./ScatterPlotChartConstants.js"

// todo: readd
@observer
export class TimeScatterChart extends ScatterPlotChart {
    constructor(props: { bounds?: Bounds; manager: ScatterPlotManager }) {
        super(props)
    }
}
