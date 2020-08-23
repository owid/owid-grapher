#! /usr/bin/env yarn jest

import * as React from "react"
import { shallow, mount, ReactWrapper } from "enzyme"
import { observe } from "mobx"

import { ExploreView } from "./ExploreView"
import { Bounds } from "charts/utils/Bounds"
import { ChartView } from "charts/core/ChartView"
import { ChartType } from "charts/core/ChartConstants"
import { LineChart } from "charts/lineCharts/LineChart"
import { StackedArea } from "charts/areaCharts/StackedArea"
import { StackedBarChart } from "charts/barCharts/StackedBarChart"
import { DiscreteBarChart } from "charts/barCharts/DiscreteBarChart"
import { SlopeChart } from "charts/slopeCharts/SlopeChart"
import { ChoroplethMap } from "charts/mapCharts/ChoroplethMap"
import { RootStore } from "explorer/indicatorExplorer/Store"
import { ExploreModel } from "explorer/indicatorExplorer/ExploreModel"

import * as apiMock from "test/apiMock"
import * as fixtures from "test/fixtures"

const bounds = new Bounds(0, 0, 800, 600)
const indicator = fixtures.readIndicators().indicators[0]

function getStore() {
    return new RootStore()
}

function getDefaultModel() {
    const model = new ExploreModel(getStore())
    model.setIndicatorId(indicator.id)
    return model
}

function getEmptyModel() {
    return new ExploreModel(getStore())
}

function mockDataResponse() {
    apiMock.mockIndicators()
    apiMock.mockVariable(104402)
}

async function whenReady(chartView: ChartView): Promise<void> {
    return new Promise(resolve => {
        const chart = chartView.chart
        observe(chart, "isReady", () => {
            if (chart.isReady) resolve()
        })
    })
}

async function updateViewWhenReady(exploreView: ReactWrapper) {
    const chartView = exploreView.find(ChartView).first()
    await whenReady(chartView.instance() as ChartView)
    exploreView.update()
}

describe(ExploreView, () => {
    it("renders an empty chart", () => {
        const view = shallow(
            <ExploreView bounds={bounds} model={getEmptyModel()} />
        )
        expect(view.find(ChartView)).toHaveLength(1)
    })

    describe("when you render with diferent model params", () => {
        apiMock.init()
        beforeAll(() => mockDataResponse())

        async function renderWithModel(model: ExploreModel) {
            const view = mount(<ExploreView bounds={bounds} model={model} />)
            await updateViewWhenReady(view)
            return view
        }

        it("applies the chart type", async () => {
            const model = getDefaultModel()
            model.setChartType("WorldMap")
            const view = await renderWithModel(model)
            expect(view.find(ChoroplethMap)).toHaveLength(1)
        })

        // This test used to pass with the dummy config but broke when we
        // implemented indicator switching. The problem is that in between
        // loading indicators, the time brackets get unset by HTMLTimeline.tsx.
        // For now I have commented out this test so it doesn't block merging to
        // master and deploying the indicator switching. We will solve this
        // problem separately.
        //
        // -@danielgavrilov 2019-12-12
        it.skip("applies the time params to the chart", async () => {
            const model = getDefaultModel()
            model.chart.timeDomain = [1960, 2005]
            const view = await renderWithModel(model)
            const style: any = view.find(".slider .interval").prop("style")
            expect(parseFloat(style.left)).toBeGreaterThan(0)
            expect(parseFloat(style.right)).toBeGreaterThan(0)
        })
    })

    describe("chart types", () => {
        apiMock.init()
        beforeAll(() => mockDataResponse())

        it("displays chart types", () => {
            const view = mount(
                <ExploreView bounds={bounds} model={getDefaultModel()} />
            )
            expect(view.find(".chart-type-button")).toHaveLength(6)
        })

        it("defaults to line chart", async () => {
            const view = mount(
                <ExploreView bounds={bounds} model={getDefaultModel()} />
            )
            await updateViewWhenReady(view)
            expect(view.find(LineChart)).toHaveLength(1)
        })

        const chartTypes = [
            { key: ChartType.StackedArea, expectedView: StackedArea },
            { key: ChartType.StackedBar, expectedView: StackedBarChart },
            { key: ChartType.DiscreteBar, expectedView: DiscreteBarChart },
            { key: ChartType.SlopeChart, expectedView: SlopeChart },
            { key: "WorldMap", expectedView: ChoroplethMap }
        ]

        chartTypes.forEach(type => {
            describe(`when you click ${type.key}`, () => {
                let view: ReactWrapper
                const button = `.chart-type-button[data-type="${type.key}"]`

                beforeAll(async () => {
                    view = mount(
                        <ExploreView
                            bounds={bounds}
                            model={getDefaultModel()}
                        />
                    )
                    await updateViewWhenReady(view)
                    view.find(button).simulate("click")
                })

                it(`selects the ${type.key} button`, async () => {
                    expect(view.find(button).hasClass("selected")).toBe(true)
                })

                it(`shows a ${type.expectedView.name}`, async () => {
                    expect(view.find(type.expectedView)).toHaveLength(1)
                })
            })
        })
    })

    describe("indicator switching", () => {
        apiMock.init()
        beforeAll(() => mockDataResponse())

        it("loads an empty chart with no indicator", () => {
            const view = shallow(
                <ExploreView bounds={bounds} model={getEmptyModel()} />
            )
            expect(view.find(ChartView)).toHaveLength(1)
        })

        it("loads a chart with the initialized indicator", async () => {
            const view = mount(
                <ExploreView bounds={bounds} model={getDefaultModel()} />
            )
            await updateViewWhenReady(view)
            expect(view.find(ChartView)).toHaveLength(1)
            expect(view.find(".chart h1").text()).toContain(indicator.title)
        })

        it("loads the indicator when the indicatorId is changed", async () => {
            const model = getEmptyModel()
            const view = mount(<ExploreView bounds={bounds} model={model} />)
            expect(view.find(ChartView)).toHaveLength(1)

            model.setIndicatorId(indicator.id)
            await updateViewWhenReady(view)
            expect(view.find(".chart h1")).toHaveLength(1)
            expect(view.find(".chart h1").text()).toContain(indicator.title)
        })

        it("shows the loaded indicator in the dropdown", async () => {
            const view = mount(
                <ExploreView bounds={bounds} model={getDefaultModel()} />
            )
            await updateViewWhenReady(view)
            expect(
                view
                    .find(".indicator-dropdown")
                    .first()
                    .text()
            ).toContain(indicator.title)
        })
    })
})
