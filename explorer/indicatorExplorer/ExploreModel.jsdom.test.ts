#! /usr/bin/env yarn jest

import { ExploreModel } from "./ExploreModel"
import { ChartType } from "grapher/core/GrapherConstants"
import { RootStore } from "explorer/indicatorExplorer/Store"

const store = new RootStore()

describe(ExploreModel, () => {
    let model: ExploreModel

    describe("when you give it a query string", () => {
        beforeAll(() => {
            const queryStr = "indicator=488&time=1960..2000&type=WorldMap"
            model = new ExploreModel(store)
            model.populateFromQueryStr(queryStr)
        })

        it("populates the indicator id", () => {
            expect(model.indicatorId).toBe(488)
        })

        it("populates the chart type", () => {
            expect(model.chartType).toBe("WorldMap")
        })

        it("populates the chart params", () => {
            expect(model.grapher.timeDomain).toEqual([2000, 2000])
        })
    })

    describe("when you set an area type", () => {
        beforeAll(() => {
            model = new ExploreModel(store)
            model.setChartType(ChartType.StackedArea)
        })

        it("updates the chart type to area", () => {
            expect(model.grapher.type).toBe(ChartType.StackedArea)
        })

        it("has a chart tab", () => {
            expect(model.grapher.hasChartTab).toBe(true)
        })

        it("doesn't have a map tab", () => {
            expect(model.grapher.hasMapTab).toBe(false)
        })

        it("is on the chart tab", () => {
            expect(model.grapher.currentTab).toBe("chart")
        })
    })

    describe("when you set a map type", () => {
        beforeAll(() => {
            model = new ExploreModel(store)
            model.setChartType(ExploreModel.WorldMap)
        })

        it("updates the chart type to line", () => {
            expect(model.grapher.type).toBe(ChartType.LineChart)
        })

        it("has a map tab", () => {
            expect(model.grapher.hasMapTab).toBe(true)
        })

        it("doesn't have a chart tab", () => {
            expect(model.grapher.hasChartTab).toBe(false)
        })

        it("is on the map tab", () => {
            expect(model.grapher.currentTab).toBe("map")
        })
    })
})
