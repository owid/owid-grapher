#! /usr/bin/env yarn jest

import {
    SynthesizeGDPTable,
    SampleColumnSlugs,
} from "coreTable/OwidTableSynthesizers"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { MapChart } from "grapher/mapCharts/MapChart"
import { legacyMapGrapher } from "grapher/mapCharts/MapChart.sample"
import { ChartTypeName, DimensionProperty } from "./GrapherConstants"

describe("grapher and map charts", () => {
    it.skip("map time tolerance plus query string works with a map chart", () => {
        const grapher = new Grapher(legacyMapGrapher)
        expect(grapher.mapColumnSlug).toBe("3512")
        expect(grapher.inputTable.minTime).toBe(2000)
        expect(grapher.inputTable.maxTime).toBe(2010)
        expect(grapher.startHandleTimeBound).toBe(2000)
        expect(grapher.endHandleTimeBound).toBe(2000)
        expect(grapher.times).toEqual([2000, 2010])
    })

    it("can change time and see more points", () => {
        const manager = new Grapher(legacyMapGrapher)
        const chart = new MapChart({ manager })

        expect(Object.keys(chart.series).length).toEqual(1)
        manager.endHandleTimeBound = 2010
        expect(Object.keys(chart.series).length).toEqual(2)
    })
})

const basicGrapherConfig: GrapherProgrammaticInterface = {
    table: SynthesizeGDPTable({ entityCount: 10 }).selectSample(5),
    dimensions: [
        {
            slug: SampleColumnSlugs.GDP,
            property: DimensionProperty.y,
            variableId: SampleColumnSlugs.GDP as any,
        },
    ],
}

describe("grapher and discrete bar charts", () => {
    const grapher = new Grapher({
        type: ChartTypeName.DiscreteBar,
        ...basicGrapherConfig,
    })
    expect(grapher.chartInstance.series.length).toBeGreaterThan(0)
})
