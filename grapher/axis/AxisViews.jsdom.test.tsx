#! /usr/bin/env jest

import { AxisConfig } from "./AxisConfig"
import { DualAxisComponent, HorizontalAxisGridLines } from "./AxisViews"
import React from "react"
import { ScaleType } from "grapher/core/GrapherConstants"
import { DualAxis } from "./Axis"

import { configure, shallow } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
configure({ adapter: new Adapter() })

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
        verticalAxis,
        horizontalAxis,
    })

    const view = shallow(<DualAxisComponent dualAxis={dualAxis} />)
    expect(view).toBeTruthy()
})
