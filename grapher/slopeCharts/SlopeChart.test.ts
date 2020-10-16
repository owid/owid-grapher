#! /usr/bin/env yarn jest

import { SlopeChart } from "./SlopeChart"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"
import { DEFAULT_SLOPE_CHART_COLOR } from "./SlopeChartConstants"
import { OwidTableSlugs } from "coreTable/OwidTableConstants"

const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
const manager: ChartManager = {
    table,
    yColumnSlug: SampleColumnSlugs.Population,
}

it("can create a new slope chart", () => {
    const chart = new SlopeChart({ manager })
    expect(chart.series.length).toEqual(2)
})

it("slope charts can have different colors", () => {
    const manager: ChartManager = {
        table,
        yColumnSlug: SampleColumnSlugs.Population,
        colorColumnSlug: OwidTableSlugs.entityName,
    }
    const chart = new SlopeChart({ manager })
    expect(chart.series[0].color).not.toEqual(DEFAULT_SLOPE_CHART_COLOR)
})
