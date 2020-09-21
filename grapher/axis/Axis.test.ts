#! /usr/bin/env yarn jest

import { HorizontalAxis } from "grapher/axis/Axis"
import { ScaleType } from "grapher/core/GrapherConstants"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { AxisConfig } from "./AxisConfig"

describe("basics", () => {
    it("can create an axis", () => {
        const axisConfig = new AxisConfig({
            scaleType: ScaleType.linear,
            min: 0,
            max: 100,
        })
        const axis = new HorizontalAxis(axisConfig)
        expect(axis.domain).toEqual([0, 100])

        const ticks = axis.getTickValues()
        expect(ticks.length).toBeGreaterThan(1)
        expect(axis.getFormattedTicks().length).toEqual(ticks.length)
    })

    it("can assign a column to an axis", () => {
        const axisConfig = new AxisConfig({
            scaleType: ScaleType.linear,
            min: 0,
            max: 100,
        })
        const table = SynthesizeOwidTable()
        const axis = new HorizontalAxis(axisConfig)
        axis.column = table.get("GDP")
        axis.clone()

        const ticks = axis.getTickValues()
        expect(ticks.length).toBeGreaterThan(1)
    })
})
