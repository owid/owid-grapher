#! /usr/bin/env yarn jest

import { AxisOptions } from "charts/axis/Axis"
import { ScaleType } from "charts/core/ChartConstants"

describe("basics", () => {
    const axis = new AxisOptions()

    it("can create an axis, clone and modify the clone without affecting the original", () => {
        expect(axis.scaleType).toEqual(ScaleType.linear)

        const clone = axis.toVerticalAxis()
        clone.scaleType = ScaleType.log
        expect(axis.scaleType).toEqual(ScaleType.linear)
        expect(clone.scaleType).toEqual(ScaleType.log)
    })
})
