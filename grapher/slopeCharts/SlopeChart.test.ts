#! /usr/bin/env yarn jest

import { SlopeChart } from "./SlopeChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { ChartManager } from "grapher/chart/ChartManager"

describe(SlopeChart, () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
    const manager: ChartManager = {
        table,
        yColumnSlug: "Population",
    }

    it("can create a new slope chart", () => {
        const chart = new SlopeChart({ manager })
        expect(chart.marks.length).toEqual(2)
    })
})
