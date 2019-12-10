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

const bounds = new Bounds(0, 0, 800, 600)
const variableJson = fs.readFileSync("test/fixtures/variable-104402.json")
const url = /\/grapher\/data\/variables\/104402\.json/

function mockDataResponse() {
    xhrMock.get(url, { body: variableJson })
}

async function updateViewWhenReady(exploreView: ReactWrapper) {
    const chartView = exploreView.find(ChartView).first()
    await (chartView.instance() as ChartView).readyPromise
    exploreView.update()
}

describe(ExploreView, () => {
    it("renders a chart", () => {
        const view = shallow(<ExploreView bounds={bounds} />)
        expect(view.find(ChartView)).toHaveLength(1)
    })

    describe("when you render with url params", () => {
        beforeAll(() => xhrMock.setup())
        afterAll(() => xhrMock.teardown())

        async function renderWithQueryStr(queryStr: string) {
            mockDataResponse()
            const view = mount(
                <ExploreView bounds={bounds} queryStr={queryStr} />
            )
            await updateViewWhenReady(view)
            return view
        }

        it("applies the chart type", async () => {
            const view = await renderWithQueryStr("type=WorldMap")
            expect(view.find(ChoroplethMap)).toHaveLength(1)
        })

        it("applies the time params to the chart", async () => {
            const view = await renderWithQueryStr("time=1960..2005")
            const style: any = view.find(".slider .interval").prop("style")
            expect(parseFloat(style.left)).toBeGreaterThan(0)
            expect(parseFloat(style.right)).toBeGreaterThan(0)
        })
    })

    describe("chart types", () => {
        beforeAll(() => xhrMock.setup())
        afterAll(() => xhrMock.teardown())

        it("displays chart types", () => {
            mockDataResponse()
            const view = mount(<ExploreView bounds={bounds} />)
            expect(view.find(".chart-type-button")).toHaveLength(6)
        })

        it("defaults to line chart", async () => {
            mockDataResponse()
            const view = mount(<ExploreView bounds={bounds} />)
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
                    view = mount(<ExploreView bounds={bounds} />)
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
