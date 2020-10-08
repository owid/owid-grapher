import { observer } from "mobx-react"
import { ScatterPlotChart } from "./ScatterPlotChart"

// todo: readd
@observer
export class TimeScatterChart extends ScatterPlotChart {
    constructor(props: any) {
        super(props)
    }
}
