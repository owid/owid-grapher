import { observer } from "mobx-react"
import { ScatterPlotChart } from "./ScatterPlotChart.js"

// todo: readd
@observer
export class TimeScatterChart extends ScatterPlotChart {
    constructor(props: any) {
        super(props)
    }
}
