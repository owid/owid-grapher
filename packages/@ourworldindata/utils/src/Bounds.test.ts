#! /usr/bin/env jest

import { Position } from "@ourworldindata/types"
import { Bounds } from "./Bounds.js"

it("can report the center", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    expect(bounds.centerX).toEqual(50)
})

it("can split a bounds into correct number of pieces", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    const quads = bounds.grid({ rows: 2, columns: 2, count: 4 })
    expect(quads.length).toEqual(4)
    const first = quads[0]
    const second = quads[1]
    const third = quads[2]
    const fourth = quads[3]

    expect(second.bounds.x).toEqual(50)
    expect(third.bounds.y).toEqual(50)
    expect(third.bounds.x).toEqual(0)
    expect(fourth.bounds.height).toEqual(50)

    expect(Array.from(first.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.left, Position.top])
    )
    expect(Array.from(second.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.top, Position.right])
    )
    expect(Array.from(third.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.left, Position.bottom])
    )
    expect(Array.from(fourth.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.bottom, Position.right])
    )
})

it("can split a bounds into an arbitrary number of pieces", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    const grid = bounds.grid({ rows: 2, columns: 4, count: 5 })
    expect(grid.length).toEqual(5)
    const first = grid[0]
    const second = grid[1]
    const third = grid[2]
    const fourth = grid[3]
    const fifth = grid[4]

    expect(second.bounds.x).toEqual(25)
    expect(third.bounds.y).toEqual(0)
    expect(third.bounds.x).toEqual(50)
    expect(fourth.bounds.height).toEqual(50)
    expect(fifth.bounds.x).toEqual(0)
    expect(fifth.bounds.y).toEqual(50)

    expect(Array.from(first.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.left, Position.top])
    )
    expect(Array.from(second.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.top, Position.bottom])
    )
    expect(Array.from(third.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.top, Position.bottom])
    )
    expect(Array.from(fourth.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.top, Position.right, Position.bottom])
    )
    expect(Array.from(fifth.cellEdges.values())).toEqual(
        expect.arrayContaining([Position.right, Position.bottom, Position.left])
    )
})

it("can split with padding between charts", () => {
    const bounds = new Bounds(10, 10, 100, 100)
    const quads = bounds.grid(
        { rows: 2, columns: 2, count: 4 },
        { rowPadding: 20, columnPadding: 20 }
    )
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

it("can detect overlapping bounds", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    const otherBounds = new Bounds(50, 50, 100, 100)
    expect(bounds.intersects(otherBounds)).toBeTruthy()
    expect(bounds.hasVerticalOverlap(otherBounds)).toBeTruthy()
    expect(bounds.hasHorizontalOverlap(otherBounds)).toBeTruthy()
})

it("can detect vertical overlap", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    const otherBounds = new Bounds(200, 50, 100, 100)
    expect(bounds.intersects(otherBounds)).toBeFalsy()
    expect(bounds.hasVerticalOverlap(otherBounds)).toBeTruthy()
    expect(bounds.hasHorizontalOverlap(otherBounds)).toBeFalsy()
})

it("can detect horizontal overlap", () => {
    const bounds = new Bounds(0, 0, 100, 100)
    const otherBounds = new Bounds(50, 200, 100, 100)
    expect(bounds.intersects(otherBounds)).toBeFalsy()
    expect(bounds.hasVerticalOverlap(otherBounds)).toBeFalsy()
    expect(bounds.hasHorizontalOverlap(otherBounds)).toBeTruthy()
})
