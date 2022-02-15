#! /usr/bin/env jest

import { AxisConfig } from "./AxisConfig.js"
import { DualAxisComponent, HorizontalAxisGridLines } from "./AxisViews.js"
import React from "react"
import { ScaleType } from "../core/GrapherConstants.js"
import { DualAxis } from "./Axis.js"

import enzyme from "enzyme"
import Adapter from "enzyme-adapter-react-16"
enzyme.configure({ adapter: new Adapter() })

it("can create horizontal axis", () => {
    const axisConfig = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
    })

    const view = enzyme.shallow(
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

    const view = enzyme.shallow(<DualAxisComponent dualAxis={dualAxis} />)
    expect(view).toBeTruthy()
})
