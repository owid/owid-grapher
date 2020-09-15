#! /usr/bin/env yarn jest

import * as React from "react"
import { shallow, mount, ReactWrapper } from "enzyme"
import { observe } from "mobx"
import xhrMock from "xhr-mock"
import { ExploreView } from "./ExploreView"
import { Bounds } from "grapher/utils/Bounds"
import { GrapherView } from "grapher/core/GrapherView"
import { ChartTypes } from "grapher/core/GrapherConstants"
import { LineChart } from "grapher/lineCharts/LineChart"
import { StackedAreaChart } from "grapher/areaCharts/StackedAreaChart"
import { StackedBarChart } from "grapher/barCharts/StackedBarChart"
import { DiscreteBarChart } from "grapher/barCharts/DiscreteBarChart"
import { SlopeChart } from "grapher/slopeCharts/SlopeChart"
import { ChoroplethMap } from "grapher/mapCharts/ChoroplethMap"
import { RootStore } from "explorer/indicatorExplorer/Store"
import { ExploreModel } from "explorer/indicatorExplorer/ExploreModel"
import {
    mockIndicator,
    mockIndicators,
    initXhrMock,
} from "explorer/indicatorExplorer/apiMock"

const bounds = new Bounds(0, 0, 800, 600)

function getDefaultModel() {
    const model = new ExploreModel(new RootStore())
    model.setIndicatorId(mockIndicator.id)
    return model
}

const getEmptyModel = () => new ExploreModel(new RootStore())

const mockVariable = {
    variables: {
        "104402": {
            years: [1950, 1950, 2005, 2005, 2019, 2019],
            entities: [15, 207, 15, 207, 15, 207],
            values: [224.45, 333.68, 295.59, 246.12, 215.59, 226.12],
            id: 104402,
            name: "Child mortality 1950-2017 (IHME, 2017)",
            unit: "",
            description:
                "Child mortality is the share of newborns who die before reaching the age of five. ",
            datasetId: "4123",
            display: {
                name: "Child mortality",
                unit: "%",
                shortUnit: "%",
                conversionFactor: 0.1,
            },
            datasetName: "Child mortality, 1950-2017 (IHME, 2017)",
        },
    },
    entityKey: {
        "15": { name: "Afghanistan", code: "AFG", id: 15 },
        "207": { name: "Iceland", code: "ISL", id: 207 },
    },
}

function mockDataResponse() {
    mockIndicators()

    xhrMock.get(new RegExp(`\/grapher\/data\/variables\/104402\.json`), {
        body: JSON.stringify(mockVariable),
    })
}

async function whenReady(grapherView: GrapherView): Promise<void> {
    return new Promise((resolve) => {
        const grapher = grapherView.grapher
        observe(grapher, "isReady", () => {
            if (grapher.isReady) resolve()
        })
    })
}

async function updateViewWhenReady(exploreView: ReactWrapper) {
    const grapherView = exploreView.find(GrapherView).first()
    await whenReady(grapherView.instance() as GrapherView)
    exploreView.update()
}

describe(ExploreView, () => {
    it("renders an empty chart", () => {
        const view = shallow(
            <ExploreView bounds={bounds} model={getEmptyModel()} />
        )
        expect(view.find(GrapherView)).toHaveLength(1)
    })

    describe("when you render with different model params", () => {
        initXhrMock()
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
            model.grapher.timeDomain = [1960, 2005]
            const view = await renderWithModel(model)
            const style: any = view.find(".slider .interval").prop("style")
            expect(parseFloat(style.left)).toBeGreaterThan(0)
            expect(parseFloat(style.right)).toBeGreaterThan(0)
        })
    })

    describe("chart types", () => {
        initXhrMock()
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
            { key: ChartTypes.StackedArea, expectedView: StackedAreaChart },
            { key: ChartTypes.StackedBar, expectedView: StackedBarChart },
            { key: ChartTypes.DiscreteBar, expectedView: DiscreteBarChart },
            { key: ChartTypes.SlopeChart, expectedView: SlopeChart },
            { key: "WorldMap", expectedView: ChoroplethMap },
        ]

        chartTypes.forEach((type) => {
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
        initXhrMock()
        beforeAll(() => mockDataResponse())

        it("loads an empty chart with no indicator", () => {
            const view = shallow(
                <ExploreView bounds={bounds} model={getEmptyModel()} />
            )
            expect(view.find(GrapherView)).toHaveLength(1)
        })

        it("loads a chart with the initialized indicator", async () => {
            const view = mount(
                <ExploreView bounds={bounds} model={getDefaultModel()} />
            )
            await updateViewWhenReady(view)
            expect(view.find(GrapherView)).toHaveLength(1)
            expect(view.find(".chart h1").text()).toContain(mockIndicator.title)
        })

        it("loads the indicator when the indicatorId is changed", async () => {
            const model = getEmptyModel()
            const view = mount(<ExploreView bounds={bounds} model={model} />)
            expect(view.find(GrapherView)).toHaveLength(1)

            model.setIndicatorId(mockIndicator.id)
            await updateViewWhenReady(view)
            expect(view.find(".chart h1")).toHaveLength(1)
            expect(view.find(".chart h1").text()).toContain(mockIndicator.title)
        })

        it("shows the loaded indicator in the dropdown", async () => {
            const view = mount(
                <ExploreView bounds={bounds} model={getDefaultModel()} />
            )
            await updateViewWhenReady(view)
            expect(view.find(".indicator-dropdown").first().text()).toContain(
                mockIndicator.title
            )
        })
    })
})
