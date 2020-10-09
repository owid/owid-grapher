#! /usr/bin/env yarn jest

import { SlopeChart } from "./SlopeChart"
import { SynthesizeGDPTable } from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"

const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
const manager: ChartManager = {
    table,
    yColumnSlug: "Population",
}

it("can create a new slope chart", () => {
    const chart = new SlopeChart({ manager })
    expect(chart.series.length).toEqual(2)
})
