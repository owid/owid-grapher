#! /usr/bin/env yarn jest

import { LineChart } from "./LineChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"

const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })

const manager = {
    table,
    yColumnSlugs: ["GDP"],
}

it("can create a new chart", () => {
    const chart = new LineChart({ manager })

    expect(chart.failMessage).toBeTruthy()
    table.selectAll()
    expect(chart.failMessage).toEqual("")
    expect(chart.marks.length).toEqual(2)
    expect(chart.placedMarks.length).toEqual(2)
    expect(chart.placedMarks[0].placedPoints[0].x).toBeGreaterThan(0)
})
