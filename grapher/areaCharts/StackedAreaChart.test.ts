#! /usr/bin/env yarn jest

import { StackedAreaChart } from "./StackedAreaChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"
import { ChartManager } from "grapher/chart/ChartManager"
import { observable } from "mobx"
import { AxisConfig } from "grapher/axis/AxisConfig"

class MockManager implements ChartManager {
    table = SynthesizeGDPTable({
        timeRange: [1950, 2010],
    })
    yColumnSlugs = ["GDP"]
    yAxis = new AxisConfig({ min: 0, max: 200 })
    @observable isRelativeMode = false
}

it("can create a basic chart", () => {
    const manager = new MockManager()
    const chart = new StackedAreaChart({ manager })
    expect(chart.failMessage).toBeTruthy()
    manager.table.selectAll()
    expect(chart.failMessage).toEqual("")
})

it("use author axis settings unless relative mode", () => {
    const manager = new MockManager()
    const chart = new StackedAreaChart({ manager })
    manager.table.selectSample(3)
    expect(chart.verticalAxis.domain[1]).toBeGreaterThan(100)
    manager.isRelativeMode = true
    expect(chart.verticalAxis.domain).toEqual([0, 100])
})
