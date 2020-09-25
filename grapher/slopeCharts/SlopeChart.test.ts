#! /usr/bin/env yarn jest

import { SlopeChart } from "./SlopeChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"

describe(SlopeChart, () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
    const options: ChartOptionsProvider = {
        table,
        yColumnSlug: "Population",
    }

    it("can create a new slope chart", () => {
        const chart = new SlopeChart({ options })
        expect(chart.marks.length).toEqual(2)
    })
})
