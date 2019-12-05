import * as React from "react"
import { shallow, mount, ReactWrapper } from "enzyme"
import xhrMock from "xhr-mock"
import * as fs from "fs"

import { ExploreView } from "../ExploreView"
import { Bounds } from "../Bounds"
import { ChartView } from "../ChartView"
import { LineChart } from "../LineChart"

const bounds = new Bounds(0, 0, 800, 600)
const variableJson = fs.readFileSync("test/fixtures/variable-104402.json")
const url = /\/grapher\/data\/variables\/104402\.json/

describe(ExploreView, () => {
    it("renders a chart", () => {
        const view = shallow(<ExploreView bounds={bounds} />)
        expect(view.find(ChartView)).toHaveLength(1)
    })

    describe("chart types", () => {
        beforeEach(() => xhrMock.setup())
        afterEach(() => xhrMock.teardown())

        function mockDataResponse() {
            xhrMock.get(url, { body: variableJson })
        }

        async function updateViewWhenReady(exploreView: ReactWrapper) {
            const chartView = exploreView.find(ChartView).first()
            await (chartView.instance() as ChartView).readyPromise
            exploreView.update()
        }

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
    })
})
