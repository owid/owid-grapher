#! /usr/bin/env yarn jest

import { StackedAreaChart } from "./StackedAreaChart"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { observable } from "mobx"
import { AxisConfig } from "grapher/axis/AxisConfig"

class MockOptions implements ChartOptionsProvider {
    table = SynthesizeOwidTable({
        timeRange: [1950, 2010],
    })
    yColumns = [this.table.get("GDP")!]
    yAxis = new AxisConfig({ min: 0, max: 200 })
    @observable isRelativeMode = false
}

describe(StackedAreaChart, () => {
    it("can create a basic chart", () => {
        const options = new MockOptions()
        const chart = new StackedAreaChart({ options })

        expect(chart.failMessage).toBeTruthy()

        options.table.selectAll()

        expect(chart.failMessage).toEqual("")
    })

    it("can create a chart and toggle relative mode", () => {
        const options = new MockOptions()
        const chart = new StackedAreaChart({ options })

        expect(chart.verticalAxis.domain[1]).toBeGreaterThan(100)

        options.isRelativeMode = true
        expect(chart.verticalAxis.domain).toEqual([0, 100])
    })
})
