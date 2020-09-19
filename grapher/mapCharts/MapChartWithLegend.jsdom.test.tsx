#! /usr/bin/env yarn jest

import { Bounds } from "grapher/utils/Bounds"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import { MapChartOptionsProvider } from "./MapChartOptionsProvider"
import { MapChartWithLegend } from "./MapChartWithLegend"

describe(MapChartWithLegend, () => {
    const table = SynthesizeOwidTable({
        timeRange: [2000, 2010],
        countryCount: 5,
    })
    const options: MapChartOptionsProvider = {
        table,
        mapColumn: table.columnsBySlug.get("Population")!,
    }

    const ChartSampleOptions = {
        bounds: new Bounds(0, 0, 640, 480),
        options,
    }

    test("can create a new Map chart", () => {
        const chart = new MapChartWithLegend(ChartSampleOptions)
        expect(Object.keys(chart.valuesByEntity).length).toEqual(5)
        expect(Object.keys(chart.marks).length).toEqual(5)

        const legends = chart.colorScale.legendData
        expect(Object.keys(legends).length).toBeGreaterThan(1)
    })
})
