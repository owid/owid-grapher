#! /usr/bin/env jest

import { FacetChart } from "./FacetChart"
import { SynthesizeGDPTable } from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"
import { FacetStrategy } from "grapher/core/GrapherConstants"

it("can create a new FacetChart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
    }
    const chart = new FacetChart({ manager })
    expect(chart.series.length).toEqual(2)
    manager.facetStrategy = FacetStrategy.column
    expect(chart.series.length).toEqual(3)
})
