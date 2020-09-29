#! /usr/bin/env yarn jest

import { AxisConfig } from "grapher/axis/AxisConfig"
import { LineLegend, LineLegendManager } from "./LineLegend"

const manager: LineLegendManager = {
    labelMarks: [
        {
            seriesName: "Canada",
            label: "Canada",
            color: "red",
            yValue: 50,
            annotation: "A country in North America",
        },
        {
            seriesName: "Mexico",
            label: "Mexico",
            color: "green",
            yValue: 20,
            annotation: "Below Canada",
        },
    ],
    legendX: 200,
    focusedSeriesNames: [],
    verticalAxis: new AxisConfig({ min: 0, max: 100 }).toVerticalAxis(),
}

it("can create a new legend", () => {
    const legend = new LineLegend({ manager })

    expect(legend.sizedLabels.length).toEqual(2)
})
