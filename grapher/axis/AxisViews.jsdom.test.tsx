#! /usr/bin/env yarn jest

import { AxisConfig } from "./AxisConfig"
import { DualAxisComponent, HorizontalAxisGridLines } from "./AxisViews"
import { shallow } from "enzyme"
import React from "react"
import { ScaleType } from "grapher/core/GrapherConstants"
import { DualAxis } from "./Axis"
import { Bounds } from "grapher/utils/Bounds"

describe("basic tests", () => {
    it("can create horizontal axis", () => {
        const axisConfig = new AxisConfig({
            scaleType: ScaleType.linear,
            min: 0,
            max: 100,
        })

        const view = shallow(
            <HorizontalAxisGridLines
                horizontalAxis={axisConfig.toHorizontalAxis()}
            />
        )
        expect(view).toBeTruthy()
    })

    it("can render a dual axis", () => {
        const verticalAxis = new AxisConfig({
            scaleType: ScaleType.linear,
            min: 0,
            max: 100,
        }).toVerticalAxis()

        const horizontalAxis = new AxisConfig({
            scaleType: ScaleType.linear,
            min: 0,
            max: 100,
        }).toHorizontalAxis()

        const dualAxis = new DualAxis({
            bounds: new Bounds(0, 0, 500, 500),
            verticalAxis,
            horizontalAxis,
        })

        const view = shallow(<DualAxisComponent dualAxis={dualAxis} />)
        expect(view).toBeTruthy()
    })
})
