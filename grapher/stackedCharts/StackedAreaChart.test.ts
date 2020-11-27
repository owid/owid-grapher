#! /usr/bin/env jest

import { StackedAreaChart } from "./StackedAreaChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"
import { observable } from "mobx"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { SelectionArray } from "grapher/selection/SelectionArray"
import { isNumber } from "clientUtils/Util"

class MockManager implements ChartManager {
    table = SynthesizeGDPTable({
        timeRange: [1950, 2010],
    })
    yColumnSlugs = [SampleColumnSlugs.GDP]
    yAxis = new AxisConfig({ min: 0, max: 200 })
    @observable isRelativeMode = false
    selection = new SelectionArray()
}

it("can create a basic chart", () => {
    const manager = new MockManager()
    const chart = new StackedAreaChart({ manager })
    expect(chart.failMessage).toBeTruthy()
    manager.selection.addToSelection(manager.table.availableEntityNames)
    expect(chart.failMessage).toEqual("")
})

describe("column charts", () => {
    it("can show custom colors for a column series", () => {
        let table = SynthesizeFruitTable()
        table = table.updateDefs((def) => {
            def.color = def.slug // Slug is not a valid color but good enough for testing
            return def
        })
        const columnsChart: ChartManager = {
            table,
            selection: table.sampleEntityName(1),
            yColumnSlugs: [
                SampleColumnSlugs.Fruit,
                SampleColumnSlugs.Vegetables,
            ],
        }
        const chart = new StackedAreaChart({ manager: columnsChart })
        expect(chart.series.map((series) => series.color)).toEqual([
            SampleColumnSlugs.Vegetables,
            SampleColumnSlugs.Fruit,
        ])
    })
})

it("use author axis settings unless relative mode", () => {
    const manager = new MockManager()
    const chart = new StackedAreaChart({ manager })
    expect(chart.verticalAxis.domain[1]).toBeGreaterThan(100)
    manager.isRelativeMode = true
    expect(chart.verticalAxis.domain).toEqual([0, 100])
})

it("shows a failure message if there are columns but no series", () => {
    const chart = new StackedAreaChart({
        manager: { table: SynthesizeFruitTable() },
    })
    expect(chart.failMessage).toBeTruthy()
})

it("can filter a series when there are no points", () => {
    const table = SynthesizeFruitTable({
        entityCount: 2,
        timeRange: [2000, 2003],
    }).replaceRandomCells(6, [SampleColumnSlugs.Fruit])
    const chart = new StackedAreaChart({
        manager: {
            selection: table.sampleEntityName(1),
            table,
        },
    })

    expect(chart.series.length).toEqual(1)
})

it("filters non-numeric values", () => {
    const table = SynthesizeFruitTableWithStringValues(
        {
            entityCount: 2,
            timeRange: [1900, 2000],
        },
        20,
        1
    )
    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }
    const chart = new StackedAreaChart({ manager })
    expect(chart.series.length).toEqual(2)
    expect(
        chart.series.every((series) =>
            series.points.every(
                (point) => isNumber(point.x) && isNumber(point.y)
            )
        )
    ).toBeTruthy()
})
