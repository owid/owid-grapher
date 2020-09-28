#! /usr/bin/env yarn jest

import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { StackedBarChart } from "./StackedBarChart"

it("can create a chart", () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })

    const manager = {
        table,
        yColumnSlugs: ["Population"],
    }

    const chart = new StackedBarChart({ manager })
    expect(chart.marks.length).toEqual(0)
    expect(chart.failMessage).toBeTruthy()

    table.selectEntity(table.availableEntityNames[0])
    expect(chart.failMessage).toEqual("")
    expect(chart.marks.length).toEqual(10)
})
