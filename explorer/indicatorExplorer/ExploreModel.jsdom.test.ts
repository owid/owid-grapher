#! /usr/bin/env yarn jest

import { ExploreModel } from "./ExploreModel"
import { ChartType } from "charts/core/ChartConstants"
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
            expect(model.chart.timeDomain).toEqual([1960, 2000])
        })
    })

    describe("when you set an area type", () => {
        beforeAll(() => {
            model = new ExploreModel(store)
            model.setChartType(ChartType.StackedArea)
        })

        it("updates the chart type to area", () => {
            expect(model.chart.props.type).toBe(ChartType.StackedArea)
        })

        it("has a chart tab", () => {
            expect(model.chart.hasChartTab).toBe(true)
        })

        it("doesn't have a map tab", () => {
            expect(model.chart.hasMapTab).toBe(false)
        })

        it("is on the chart tab", () => {
            expect(model.chart.tab).toBe("chart")
        })
    })

    describe("when you set a map type", () => {
        beforeAll(() => {
            model = new ExploreModel(store)
            model.setChartType(ExploreModel.WorldMap)
        })

        it("updates the chart type to line", () => {
            expect(model.chart.props.type).toBe(ChartType.LineChart)
        })

        it("has a map tab", () => {
            expect(model.chart.hasMapTab).toBe(true)
        })

        it("doesn't have a chart tab", () => {
            expect(model.chart.hasChartTab).toBe(false)
        })

        it("is on the map tab", () => {
            expect(model.chart.tab).toBe("map")
        })
    })
})
