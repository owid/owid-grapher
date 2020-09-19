#! /usr/bin/env yarn jest

import { SlopeChart } from "./SlopeChart"
import { Bounds } from "grapher/utils/Bounds"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import { SlopeChartOptionsProvider } from "./SlopeChartOptionsProvider"

describe(SlopeChart, () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
    const options: SlopeChartOptionsProvider = {
        table,
        yColumn: table.get("Population"),
    }

    const SlopeChartSampleOptions = {
        bounds: new Bounds(0, 0, 640, 480),
        options,
    }
    it("can create a new slope chart", () => {
        const chart = new SlopeChart(SlopeChartSampleOptions)
        expect(chart.marks.length).toEqual(2)
    })
})
