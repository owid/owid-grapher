#! /usr/bin/env jest

import { SlopeChart } from "./SlopeChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import { isNumber } from "@ourworldindata/utils"

const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
const manager: ChartManager = {
    table,
    yColumnSlug: SampleColumnSlugs.Population,
    selection: table.availableEntityNames,
}

it("can create a new slope chart", () => {
    const chart = new SlopeChart({ manager })
    expect(chart.series.length).toEqual(2)
})

it("filters non-numeric values", () => {
    const table = SynthesizeFruitTableWithStringValues(
        {
            entityCount: 2,
            timeRange: [2000, 2002],
        },
        1,
        1
    )
    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }
    const chart = new SlopeChart({ manager })
    expect(chart.series.length).toEqual(1)
    expect(
        chart.series.every(
            (series) => isNumber(series.startValue) && isNumber(series.endValue)
        )
    ).toBeTruthy()
})
