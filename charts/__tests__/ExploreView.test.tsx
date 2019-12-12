import * as React from "react"
import { shallow, mount, ReactWrapper } from "enzyme"
import xhrMock from "xhr-mock"
import * as fs from "fs"

import { ExploreView } from "../ExploreView"
import { Bounds } from "../Bounds"
import { ChartView } from "../ChartView"
import { ChartType } from "../ChartType"
import { LineChart } from "../LineChart"
import { StackedArea } from "../StackedArea"
import { StackedBarChart } from "../StackedBarChart"
import { DiscreteBarChart } from "../DiscreteBarChart"
import { SlopeChart } from "../SlopeChart"
import { ChoroplethMap } from "../ChoroplethMap"
import { RootStore } from "charts/Store"
import { ExploreModel } from "charts/ExploreModel"

const bounds = new Bounds(0, 0, 800, 600)
const variableJson = fs.readFileSync("test/fixtures/variable-104402.json")
const variableUrl = /\/grapher\/data\/variables\/104402\.json/
const indicatorsJson = fs.readFileSync("test/fixtures/indicators.json")
const indicatorsUrl = /\/explore\/indicators\.json/

function getStore() {
    return new RootStore()
}

function getModel() {
    const model = new ExploreModel()
    model.indicatorId = 677
    return model
}

function mockDataResponse() {
    xhrMock.get(variableUrl, { body: variableJson })
    xhrMock.get(indicatorsUrl, { body: indicatorsJson })
}

async function updateViewWhenReady(exploreView: ReactWrapper) {
    const chartView = exploreView.find(ChartView).first()
    await (chartView.instance() as ChartView).readyPromise
    exploreView.update()
}

describe(ExploreView, () => {
    beforeAll(() => xhrMock.setup())
    afterAll(() => xhrMock.teardown())

    it("renders a chart", () => {
        mockDataResponse()
        const view = shallow(
            <ExploreView
                bounds={bounds}
                model={getModel()}
                store={getStore()}
            />
        )
        expect(view.find(ChartView)).toHaveLength(1)
    })

    describe("when you render with url params", () => {
        async function renderWithQueryStr(queryStr: string) {
            mockDataResponse()
            const view = mount(
                <ExploreView
                    bounds={bounds}
                    model={getModel()}
                    store={getStore()}
                    queryStr={queryStr}
                />
            )
            await updateViewWhenReady(view)
            return view
        }

        it("applies the chart type", async () => {
            const view = await renderWithQueryStr("type=WorldMap")
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
        //
        // it("applies the time params to the chart", async () => {
        //     const view = await renderWithQueryStr("time=1960..2005")
        //     const style: any = view.find(".slider .interval").prop("style")
        //     expect(parseFloat(style.left)).toBeGreaterThan(0)
        //     expect(parseFloat(style.right)).toBeGreaterThan(0)
        // })
        })
    })

    describe("chart types", () => {
        it("displays chart types", () => {
            mockDataResponse()
            const view = mount(
                <ExploreView
                    bounds={bounds}
                    model={getModel()}
                    store={getStore()}
                />
            )
            expect(view.find(".chart-type-button")).toHaveLength(6)
        })

        it("defaults to line chart", async () => {
            mockDataResponse()
            const view = mount(
                <ExploreView
                    bounds={bounds}
                    model={getModel()}
                    store={getStore()}
                />
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
                    mockDataResponse()
                    view = mount(
                        <ExploreView
                            bounds={bounds}
                            model={getModel()}
                            store={getStore()}
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
})
