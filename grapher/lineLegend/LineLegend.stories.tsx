import { AxisConfig } from "grapher/axis/AxisConfig"
import * as React from "react"
import { LineLegend, LineLegendOptionsProvider } from "./LineLegend"

export default {
    title: "LineLegend",
    component: LineLegend,
}

const options: LineLegendOptionsProvider = {
    legendItems: [
        {
            entityName: "Canada",
            label: "Canada",
            color: "red",
            yValue: 50,
            annotation: "A country in North America",
        },
        {
            entityName: "Mexico",
            label: "Mexico",
            color: "green",
            yValue: 20,
            annotation: "Below Canada",
        },
    ],
    legendX: 200,
    focusedEntityNames: [],
    verticalAxis: new AxisConfig({ min: 0, max: 100 }).toVerticalAxis(),
}

export const Default = () => {
    return (
        <svg width={600} height={400}>
            <LineLegend options={options} />
        </svg>
    )
}
