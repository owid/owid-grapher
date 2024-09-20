#! /usr/bin/env jest

import { AxisConfig } from "../axis/AxisConfig"
import { ScaleType } from "@ourworldindata/types"

it("serializes max to 'auto' if undefined", () => {
    const axis = new AxisConfig({ min: 1 })
    const obj = axis.toObject()
    expect(obj.min).toBe(1)
    expect(obj.max).toBe("auto")
})

it("serializes min to 'auto' if undefined", () => {
    const axis = new AxisConfig({ max: 0 })
    const obj = axis.toObject()
    expect(obj.max).toBe(0)
    expect(obj.min).toBe("auto")
})

it("can create an axis, clone and modify the clone without affecting the original", () => {
    const axis = new AxisConfig({ scaleType: ScaleType.linear })
    expect(axis.scaleType).toEqual(ScaleType.linear)

    const clone = axis.toVerticalAxis()
    clone.scaleType = ScaleType.log
    expect(axis.scaleType).toEqual(ScaleType.linear)
    expect(clone.scaleType).toEqual(ScaleType.log)
})

it("can expand the domain beyond the user's settings and not shrink it", () => {
    const axis = new AxisConfig({
        min: 0,
        max: 100,
        scaleType: ScaleType.linear,
    })
    const clone = axis.toVerticalAxis()
    clone.updateDomainPreservingUserSettings([5, 50])
    expect(clone.domain).toEqual([0, 100])
    clone.updateDomainPreservingUserSettings([-5, 500])
    expect(clone.domain).toEqual([-5, 500])
})

it("ignores undefined values", () => {
    const axis = new AxisConfig({
        min: 0,
        max: 100,
        scaleType: ScaleType.linear,
    })
    const clone = axis.toVerticalAxis()
    clone.updateDomainPreservingUserSettings([undefined, 150])
    expect(clone.domain).toEqual([0, 150])
    clone.updateDomainPreservingUserSettings([-5, undefined])
    expect(clone.domain).toEqual([-5, 150])
    clone.updateDomainPreservingUserSettings([undefined, undefined])
    expect(clone.domain).toEqual([-5, 150])
})
