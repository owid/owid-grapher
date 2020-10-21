#! /usr/bin/env yarn jest

import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { MapChartManager } from "./MapChartConstants"
import { MapChart } from "./MapChart"

const table = SynthesizeGDPTable({
    timeRange: [2000, 2001],
    entityNames: ["France", "Germany"],
})
const manager: MapChartManager = {
    table,
    mapColumnSlug: SampleColumnSlugs.Population,
    endTime: 2000,
}

test("can create a new Map chart", () => {
    const chart = new MapChart({ manager })
    expect(Object.keys(chart.series).length).toEqual(2)

    const legends = chart.colorScale.legendBins
    expect(Object.keys(legends).length).toBeGreaterThan(1)
})
