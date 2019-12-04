import * as React from "react"
import { shallow, mount } from "enzyme"
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
    beforeEach(() => xhrMock.setup())
    afterEach(() => xhrMock.teardown())

    it("renders a chart", () => {
        const view = shallow(<ExploreView bounds={bounds} />)
        expect(view.find(ChartView)).toHaveLength(1)
    })

    describe("chart types", () => {
        it("displays chart types", () => {
            const view = mount(<ExploreView bounds={bounds} />)
            expect(view.find(".chart-type-button")).toHaveLength(6)
        })

        it("defaults to line chart", async () => {
            xhrMock.get(url, { body: variableJson })
            const view = mount(<ExploreView bounds={bounds} />)
            const chartView = view.find(ChartView).first()
            await (chartView.instance() as ChartView).readyPromise
            view.update()
            expect(view.find(LineChart)).toHaveLength(1)
        })
    })
})
