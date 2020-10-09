#! /usr/bin/env yarn jest

import { HorizontalAxis } from "grapher/axis/Axis"
import { ScaleType } from "grapher/core/GrapherConstants"
import { SynthesizeGDPTable } from "coreTable/OwidTableSynthesizers"
import { AxisConfig } from "./AxisConfig"

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
    const table = SynthesizeGDPTable()
    const axis = new HorizontalAxis(axisConfig)
    axis.formatColumn = table.get("GDP")
    axis.clone()

    const ticks = axis.getTickValues()
    expect(ticks.length).toBeGreaterThan(1)
})
