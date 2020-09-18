#! /usr/bin/env yarn jest

import { SlopeChart } from "./SlopeChart"
import { Bounds } from "grapher/utils/Bounds"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import { SlopeChartOptionsProvider } from "./SlopeChartOptionsProvider"

const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
const options: SlopeChartOptionsProvider = {
    entityType: "Country",
    addCountryMode: "add-country",
    table,
    yColumnSlug: "Population",
}

const SlopeChartSampleOptions = {
    bounds: new Bounds(0, 0, 640, 480),
    options,
}

describe(SlopeChart, () => {
    it("can create a new slope chart", () => {
        const chart = new SlopeChart(SlopeChartSampleOptions)
        expect(chart.data.length).toEqual(2)
    })
})
