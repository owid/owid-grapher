import * as React from "react"
import { shallow } from "enzyme"

import { ExploreView } from "../ExploreView"
import { Bounds } from "../Bounds"
import { ChartView } from "../ChartView"

describe(ExploreView, () => {
    it("renders a chart", () => {
        let bounds = new Bounds(0, 0, 800, 600)
        expect(shallow(<ExploreView bounds={bounds}/>).find(ChartView).length).toBe(1)
    })
})
