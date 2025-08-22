import { expect, it } from "vitest"

import { FocusArray } from "./FocusArray"

const seriesNames = ["Europe", "USA", "China"]

it("can create a focus array", () => {
    const focusArray = new FocusArray()
    expect(focusArray.isEmpty).toEqual(true)
})

it("an active series is also in the foreground", () => {
    // all series are currently focused
    const focusArray = new FocusArray()
    focusArray.add(...seriesNames)

    // all series are active and in the foreground
    for (const seriesName of seriesNames) {
        expect(focusArray.has(seriesName)).toEqual(true)
        expect(focusArray.state(seriesName).foreground).toEqual(true)
    }
})

it("a foreground series is not necessarily active", () => {
    // no series is currently focused
    const focusArray = new FocusArray()

    // all series are in the foreground but not active
    for (const seriesName of seriesNames) {
        expect(focusArray.state(seriesName).foreground).toEqual(true)
        expect(focusArray.has(seriesName)).toEqual(false)
    }
})

it("a series can't be in the foreground and background at the same time", () => {
    // a subset of series is currently focused
    const focusArray = new FocusArray()
    focusArray.add(seriesNames[0])

    // all series are either in the foreground or background, but not both
    for (const seriesName of seriesNames) {
        const state = focusArray.state(seriesName)
        expect(state.foreground).not.toEqual(state.background)
    }
})

it("can toggle focus state", () => {
    const focusArray = new FocusArray()
    const example = seriesNames[0]

    expect(focusArray.has(example)).toEqual(false)
    focusArray.toggle(example)
    expect(focusArray.has(example)).toEqual(true)
    focusArray.toggle(example)
    expect(focusArray.has(example)).toEqual(false)
})
