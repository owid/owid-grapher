#! /usr/bin/env yarn jest

import { SlopeChart } from "./SlopeChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"
import { DEFAULT_SLOPE_CHART_COLOR } from "./SlopeChartConstants"
import { OwidTableSlugs } from "coreTable/OwidTableConstants"
import { isNumber } from "clientUtils/Util"

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
        chart.series.every((series) =>
            series.values.every(
                (value) => isNumber(value.x) && isNumber(value.y)
            )
        )
    ).toBeTruthy()
})
