#! /usr/bin/env jest

import { DimensionProperty } from "@ourworldindata/utils"
import {
    SynthesizeGDPTable,
    SampleColumnSlugs,
} from "@ourworldindata/core-table"
import { GrapherProgrammaticInterface, GrapherState } from "../core/Grapher"
import { MapChart } from "../mapCharts/MapChart"
import { legacyMapGrapher } from "../mapCharts/MapChart.sample"
import { GRAPHER_CHART_TYPES } from "@ourworldindata/types"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "./LegacyToOwidTable.js"

describe("grapher and map charts", () => {
    describe("map time tolerance plus query string works with a map chart", () => {
        const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
            legacyMapGrapher.owidDataset!,
            legacyMapGrapher.dimensions!,
            legacyMapGrapher.selectedEntityColors
        )
        const grapher = new GrapherState({
            ...legacyMapGrapher,
            table: inputTable,
        })

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
        const manager = new GrapherState(legacyMapGrapher)
        manager.inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
            legacyMapGrapher.owidDataset!,
            legacyMapGrapher.dimensions!,
            legacyMapGrapher.selectedEntityColors
        )
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
    const grapher = new GrapherState({
        chartTypes: [GRAPHER_CHART_TYPES.DiscreteBar],
        ...basicGrapherConfig,
    })
    expect(grapher.chartInstance.series.length).toBeGreaterThan(0)
})
