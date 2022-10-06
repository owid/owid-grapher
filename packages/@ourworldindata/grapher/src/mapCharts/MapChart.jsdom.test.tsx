#! /usr/bin/env jest

import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { MapChartManager } from "./MapChartConstants.js"
import { MapChart } from "./MapChart.js"

const table = SynthesizeGDPTable({
    timeRange: [2000, 2001],
    entityNames: ["France", "Germany", "World"],
})
const manager: MapChartManager = {
    table,
    mapColumnSlug: SampleColumnSlugs.Population,
    endTime: 2000,
}

it("can create a new Map chart", () => {
    const chart = new MapChart({ manager })
    expect(Object.keys(chart.series).length).toEqual(2)

    const legends = chart.colorScale.legendBins
    expect(Object.keys(legends).length).toBeGreaterThan(1)
})

it("filters out non-map entities from colorScaleColumn", () => {
    const chart = new MapChart({ manager })
    expect(chart.colorScaleColumn.uniqEntityNames).toEqual(
        expect.arrayContaining(["France", "Germany"])
    )
})
