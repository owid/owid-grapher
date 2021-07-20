#! /usr/bin/env jest

import { Bounds } from "./Bounds"

it("can report the center", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    expect(bounds.centerX).toEqual(50)
})

it("can split a bounds into correct number of pieces", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    const quads = bounds.grid(4)
    expect(quads.length).toEqual(4)
    const second = quads[1]
    const third = quads[2]
    const fourth = quads[3]

    expect(second.bounds.x).toEqual(50)
    expect(third.bounds.y).toEqual(50)
    expect(third.bounds.x).toEqual(0)
    expect(fourth.bounds.height).toEqual(50)
})

it("can split with padding between charts", () => {
    const bounds = new Bounds(10, 10, 100, 100)
    const quads = bounds.grid(4, { rowPadding: 20, columnPadding: 20 })
    expect(quads.length).toEqual(4)
    const second = quads[1]
    const third = quads[2]
    const fourth = quads[3]

    expect(second.bounds.x).toEqual(70)
    expect(third.bounds.y).toEqual(70)
    expect(third.bounds.x).toEqual(10)
    expect(fourth.bounds.height).toEqual(40)
})
