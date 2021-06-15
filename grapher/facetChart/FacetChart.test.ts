#! /usr/bin/env jest

import { FacetChart } from "./FacetChart"
import { SynthesizeGDPTable } from "../../coreTable/OwidTableSynthesizers"
import { ChartManager } from "../chart/ChartManager"
import { FacetStrategy } from "../core/GrapherConstants"
import { AxisConfig } from "../axis/AxisConfig"

it("can create a new FacetChart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yAxis: new AxisConfig(),
    }
    const chart = new FacetChart({ manager })

    // default to country facets
    expect(chart.series.length).toEqual(2)

    // switch to column facets
    manager.facetStrategy = FacetStrategy.column
    expect(chart.series.length).toEqual(3)
})

it("uses the transformed data for display in country mode", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        // simulate the transformation that is done by Grapher on the data
        transformedTable: table.filterByTimeRange(2002, 2008),
        facetStrategy: FacetStrategy.country,
        yAxis: new AxisConfig(),
    }
    const chart = new FacetChart({ manager })

    // we should be using the transformed table
    chart.series.forEach((s) => {
        expect(s.manager.table!.minTime).toEqual(2002)
        expect(s.manager.table!.maxTime).toEqual(2008)
    })
})
