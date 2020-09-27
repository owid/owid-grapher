#! /usr/bin/env yarn jest

import { AxisConfig } from "grapher/axis/AxisConfig"
import { LineLegend, LineLegendOptionsProvider } from "./LineLegend"

const options: LineLegendOptionsProvider = {
    labelMarks: [
        {
            lineName: "Canada",
            label: "Canada",
            color: "red",
            yValue: 50,
            annotation: "A country in North America",
        },
        {
            lineName: "Mexico",
            label: "Mexico",
            color: "green",
            yValue: 20,
            annotation: "Below Canada",
        },
    ],
    legendX: 200,
    focusedLineNames: [],
    verticalAxis: new AxisConfig({ min: 0, max: 100 }).toVerticalAxis(),
}

describe(LineLegend, () => {
    it("can create a new legend", () => {
        const legend = new LineLegend({ options })

        expect(legend.sizedLabels.length).toEqual(2)
    })
})
