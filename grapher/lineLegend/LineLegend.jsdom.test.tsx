#! /usr/bin/env yarn jest

import { AxisConfig } from "grapher/axis/AxisConfig"
import { LineLegend, LineLegendOptionsProvider } from "./LineLegend"

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
    focusKeys: [],
    verticalAxis: new AxisConfig({ min: 0, max: 100 }).toVerticalAxis(),
}

describe(LineLegend, () => {
    it("can create a new legend", () => {
        const legend = new LineLegend({ options })

        expect(legend.marks.length).toEqual(2)
    })
})
