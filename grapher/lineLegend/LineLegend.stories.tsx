import { DualAxis } from "grapher/axis/Axis"
import { AxisConfig } from "grapher/axis/AxisConfig"
import * as React from "react"
import { LineLegend, LineLegendManager } from "./LineLegend"

export default {
    title: "LineLegend",
    component: LineLegend,
}

const verticalAxis = new AxisConfig({
    min: 0,
    max: 100,
}).toVerticalAxis()

const horizontalAxis = new AxisConfig({
    min: 0,
    max: 100,
}).toHorizontalAxis()

const dualAxis = new DualAxis({
    verticalAxis,
    horizontalAxis,
})

const collidingNumber = 50

const manager: LineLegendManager = {
    labelSeries: [
        {
            seriesName: "Canada",
            label: "Canada",
            color: "red",
            yValue: collidingNumber,
            annotation: "A country in North America",
        },
        {
            seriesName: "USA",
            label: "USA",
            color: "blue",
            yValue: collidingNumber,
            annotation: "In between",
        },
        {
            seriesName: "Mexico",
            label: "Mexico",
            color: "green",
            yValue: 20,
            annotation: "Below",
        },
    ],
    legendX: 200,
    focusedSeriesNames: [],
    verticalAxis: dualAxis.verticalAxis,
}

export const TestCollisionDetection = () => {
    return (
        <svg width={600} height={400}>
            <LineLegend manager={manager} />
        </svg>
    )
}
