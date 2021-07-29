#! /usr/bin/env jest

import { Bounds } from "./Bounds"
import { Position } from "./owidTypes"

it("can report the center", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    expect(bounds.centerX).toEqual(50)
})

it("can split a bounds into correct number of pieces", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    const quads = bounds.grid(4, 1)
    expect(quads.length).toEqual(4)
    const first = quads[0]
    const second = quads[1]
    const third = quads[2]
    const fourth = quads[3]

    expect(second.bounds.x).toEqual(50)
    expect(third.bounds.y).toEqual(50)
    expect(third.bounds.x).toEqual(0)
    expect(fourth.bounds.height).toEqual(50)

    expect(Array.from(first.edges.values())).toEqual(
        expect.arrayContaining([Position.left, Position.top])
    )
    expect(Array.from(second.edges.values())).toEqual(
        expect.arrayContaining([Position.top, Position.right])
    )
    expect(Array.from(third.edges.values())).toEqual(
        expect.arrayContaining([Position.left, Position.bottom])
    )
    expect(Array.from(fourth.edges.values())).toEqual(
        expect.arrayContaining([Position.bottom, Position.right])
    )
})

it("can split with padding between charts", () => {
    const bounds = new Bounds(10, 10, 100, 100)
    const quads = bounds.grid(4, 1, { rowPadding: 20, columnPadding: 20 })
    expect(quads.length).toEqual(4)
    const second = quads[1]
    const third = quads[2]
    const fourth = quads[3]

    expect(second.bounds.x).toEqual(70)
    expect(third.bounds.y).toEqual(70)
    expect(third.bounds.x).toEqual(10)
    expect(fourth.bounds.height).toEqual(40)
})

it("can pad & expand by position", () => {
    const bounds = new Bounds(10, 10, 100, 100)

    const pad = { top: 5, bottom: 10, left: 20, right: 50 }
    const paddedBounds = bounds.pad(pad)
    expect(paddedBounds.x).toEqual(30)
    expect(paddedBounds.y).toEqual(15)
    expect(paddedBounds.width).toEqual(30)
    expect(paddedBounds.height).toEqual(85)

    const expandedBounds = paddedBounds.expand(pad)
    expect(expandedBounds.equals(bounds)).toBeTruthy()
})
