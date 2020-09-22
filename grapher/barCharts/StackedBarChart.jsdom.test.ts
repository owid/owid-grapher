#! /usr/bin/env yarn jest

import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { StackedBarChart } from "./StackedBarChart"

describe(StackedBarChart, () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })

    const options = {
        table,
        yColumns: [table.get("Population")!],
    }

    it("can create a chart", () => {
        const chart = new StackedBarChart({ options })
        expect(chart.marks.length).toEqual(0)
        expect(chart.failMessage).toBeTruthy()

        table.selectAll()
        expect(chart.failMessage).toEqual("")

        expect(chart.marks.length).toEqual(2)
    })
})
