#! /usr/bin/env yarn jest

import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { MapChartManager } from "./MapChartConstants"
import { MapChartWithLegend } from "./MapChartWithLegend"

describe(MapChartWithLegend, () => {
    const table = SynthesizeOwidTable({
        timeRange: [2000, 2010],
        countryNames: ["France", "Germany"],
    })
    const manager: MapChartManager = {
        table,
        mapColumnSlug: "Population",
    }

    test("can create a new Map chart", () => {
        const chart = new MapChartWithLegend({ manager })
        expect(Object.keys(chart.marks).length).toEqual(2)

        const legends = chart.colorScale.legendBins
        expect(Object.keys(legends).length).toBeGreaterThan(1)
    })
})
