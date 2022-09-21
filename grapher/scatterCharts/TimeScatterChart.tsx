import { observer } from "mobx-react"
import { Bounds } from "../../clientUtils/Bounds.js"
import { ScatterPlotChart } from "./ScatterPlotChart.js"
import { ScatterPlotManager } from "./ScatterPlotChartConstants.js"

// todo: readd
export const TimeScatterChart = observer(class TimeScatterChart extends ScatterPlotChart {
    constructor(props: { bounds?: Bounds; manager: ScatterPlotManager }) {
        super(props)
    }
});
