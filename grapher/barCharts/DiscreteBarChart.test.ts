#! /usr/bin/env yarn jest

import { DiscreteBarChart } from "./DiscreteBarChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { DiscreteBarChartManager } from "./DiscreteBarChartConstants"

const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })

const manager: DiscreteBarChartManager = {
    table,
    yColumnSlug: "Population",
}

it("can create a new bar chart", () => {
    const chart = new DiscreteBarChart({ manager })

    expect(chart.failMessage).toBeTruthy()
    table.selectAll()
    expect(chart.failMessage).toEqual("")

    const marks = chart.series
    expect(marks.length).toEqual(2)
    expect(marks[0].time).toBeTruthy()
})
