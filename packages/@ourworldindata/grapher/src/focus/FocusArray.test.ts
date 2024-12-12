#! /usr/bin/env jest

import { FocusArray } from "./FocusArray"

const seriesNames = ["Europe", "USA", "China"]

it("can create a focus array", () => {
    const focusArray = new FocusArray()
    expect(focusArray.isEmpty).toEqual(true)
})

it("an active series is also in the foreground", () => {
    const focusArray = new FocusArray()
    focusArray.add(...seriesNames)

    for (const seriesName of seriesNames) {
        expect(focusArray.has(seriesName)).toEqual(
            focusArray.isInForeground(seriesName)
        )
    }
})

it("a foreground series is not necessarily active", () => {
    const focusArray = new FocusArray()

    for (const seriesName of seriesNames) {
        expect(focusArray.has(seriesName)).not.toEqual(
            focusArray.isInForeground(seriesName)
        )
    }
})

it("a series can't be in the foreground and background at the same time", () => {
    const focusArray = new FocusArray()
    focusArray.add(seriesNames[0])

    for (const seriesName of seriesNames) {
        expect(focusArray.isInForeground(seriesName)).not.toEqual(
            focusArray.isInBackground(seriesName)
        )
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
