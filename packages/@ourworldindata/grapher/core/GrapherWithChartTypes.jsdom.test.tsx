#! /usr/bin/env jest

import { DimensionProperty } from "../../clientUtils/owidTypes.js"
import {
    SynthesizeGDPTable,
    SampleColumnSlugs,
} from "../../coreTable/OwidTableSynthesizers.js"
import { Grapher, GrapherProgrammaticInterface } from "../core/Grapher.js"
import { MapChart } from "../mapCharts/MapChart.js"
import { legacyMapGrapher } from "../mapCharts/MapChart.sample.js"
import { ChartTypeName } from "./GrapherConstants.js"

describe("grapher and map charts", () => {
    describe("map time tolerance plus query string works with a map chart", () => {
        const grapher = new Grapher(legacyMapGrapher)
        expect(grapher.mapColumnSlug).toBe("3512")
        expect(grapher.inputTable.minTime).toBe(2000)
        expect(grapher.inputTable.maxTime).toBe(2010)
        expect(grapher.times).toEqual([2000, 2010])

        // Todo: not actually clear what the desired behavior is here (we have a query string time not actually an available time.)
        it("sets correct time handles", () => {
            expect(grapher.startHandleTimeBound).toBe(2000)
            expect(grapher.endHandleTimeBound).toBe(2000)
        })
    })

    it("can change time and see more points", () => {
        const manager = new Grapher(legacyMapGrapher)
        const chart = new MapChart({ manager })

        expect(Object.keys(chart.series).length).toEqual(1)
        manager.endHandleTimeBound = 2010
        expect(Object.keys(chart.series).length).toEqual(2)
    })
})

const table = SynthesizeGDPTable({ entityCount: 10 })
const basicGrapherConfig: GrapherProgrammaticInterface = {
    table,
    selectedEntityNames: table.sampleEntityName(5),
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
