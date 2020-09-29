#! /usr/bin/env yarn jest

import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { StackedBarChart } from "./StackedBarChart"

it("can create a chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })

    const manager = {
        table,
        yColumnSlugs: ["Population"],
    }

    const chart = new StackedBarChart({ manager })
    expect(chart.failMessage).toBeTruthy()

    table.selectSample(1)
    expect(chart.failMessage).toEqual("")
    expect(chart.marks[0].points.length).toEqual(10)
})
