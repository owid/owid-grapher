#! /usr/bin/env yarn jest

import {
    DiscreteBarChart,
    DiscreteBarChartOptionsProvider,
} from "./DiscreteBarChart"
import { Bounds } from "grapher/utils/Bounds"
import { SynthesizeOwidTable } from "owidTable/OwidTable"

const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })
const options: DiscreteBarChartOptionsProvider = {
    baseFontSize: 16,
    entityType: "Country",
    table,
    yColumnSlug: "Population",
}

const DiscreteBarChartSampleOptions = {
    bounds: new Bounds(0, 0, 640, 480),
    options,
}

describe(DiscreteBarChart, () => {
    it("can create a new bar chart", () => {
        const chart = new DiscreteBarChart(DiscreteBarChartSampleOptions)

        expect(chart.failMessage).toEqual(undefined)
        expect(chart.currentData.length).toEqual(2)
    })
})
