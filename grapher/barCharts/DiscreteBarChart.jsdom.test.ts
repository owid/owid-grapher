#! /usr/bin/env yarn jest

import {
    DiscreteBarChart,
    DiscreteBarChartOptionsProvider,
} from "./DiscreteBarChart"
import { Bounds } from "grapher/utils/Bounds"
import { SynthesizeOwidTable } from "owidTable/OwidTable"

describe(DiscreteBarChart, () => {
    const table = SynthesizeOwidTable({ timeRange: [2000, 2010] })

    const options: DiscreteBarChartOptionsProvider = {
        table,
        yColumn: table.get("Population"),
    }

    const DiscreteBarChartSampleOptions = {
        bounds: new Bounds(0, 0, 640, 480),
        options,
    }

    it("can create a new bar chart", () => {
        const chart = new DiscreteBarChart(DiscreteBarChartSampleOptions)

        expect(chart.failMessage).toBeTruthy()
        table.selectAll()
        expect(chart.failMessage).toEqual(undefined)
        expect(chart.marks.length).toEqual(2)
    })
})
