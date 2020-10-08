#! /usr/bin/env yarn jest

import { LineChart } from "./LineChart"
import { SampleColumnSlugs, SynthesizeGDPTable } from "coreTable/OwidTable"

const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })

const manager = {
    table,
    yColumnSlugs: [SampleColumnSlugs.GDP],
}

it("can create a new chart", () => {
    const chart = new LineChart({ manager })

    expect(chart.failMessage).toBeTruthy()
    table.selectAll()
    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.placedSeries.length).toEqual(2)
    expect(chart.placedSeries[0].placedPoints[0].x).toBeGreaterThan(0)
})
