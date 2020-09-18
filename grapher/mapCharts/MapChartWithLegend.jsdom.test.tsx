#! /usr/bin/env yarn jest

import { Bounds } from "grapher/utils/Bounds"
import { SynthesizeTable } from "owidTable/OwidTable"
import { MapChartOptionsProvider } from "./MapChartOptionsProvider"
import { MapChartWithLegend } from "./MapChartWithLegend"

const table = SynthesizeTable({ timeRange: [2000, 2010], countryCount: 5 })
const options: MapChartOptionsProvider = {
    baseFontSize: 16,
    entityType: "Country",
    table,
    mapColumn: table.columnsBySlug.get("Population")!,
}

const ChartSampleOptions = {
    bounds: new Bounds(0, 0, 640, 480),
    options,
}

describe(MapChartWithLegend, () => {
    test("can create a new Map chart", () => {
        const chart = new MapChartWithLegend(ChartSampleOptions)
        expect(Object.keys(chart.valuesByEntity).length).toEqual(5)
        expect(Object.keys(chart.choroplethData).length).toEqual(5)

        const legends = chart.colorScale.legendData
        expect(Object.keys(legends).length).toBeGreaterThan(1)
    })
})
