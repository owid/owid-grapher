#! /usr/bin/env yarn jest

import {
    DiscreteBarChart,
    DiscreteBarChartOptionsProvider,
} from "./DiscreteBarChart"
import { SynthesizeOwidTable } from "owidTable/OwidTable"

describe(DiscreteBarChart, () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })

    const options: DiscreteBarChartOptionsProvider = {
        table,
        yColumn: table.get("Population"),
    }

    it("can create a new bar chart", () => {
        const chart = new DiscreteBarChart({ options })

        expect(chart.failMessage).toBeTruthy()
        table.selectAll()
        expect(chart.failMessage).toEqual("")
        expect(chart.marks.length).toEqual(2)
    })
})
