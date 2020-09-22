#! /usr/bin/env yarn jest

import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { MapChartOptionsProvider } from "./MapChartConstants"
import { MapChartWithLegend } from "./MapChartWithLegend"

describe(MapChartWithLegend, () => {
    const table = SynthesizeOwidTable({
        timeRange: [2000, 2010],
        countryCount: 5,
    })
    const options: MapChartOptionsProvider = {
        table,
        mapColumn: table.get("Population")!,
    }

    test("can create a new Map chart", () => {
        const chart = new MapChartWithLegend({ options })
        expect(Object.keys(chart.marks).length).toEqual(5)

        const legends = chart.colorScale.legendBins
        expect(Object.keys(legends).length).toBeGreaterThan(1)
    })
})
