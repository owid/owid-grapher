#! /usr/bin/env yarn jest

import { Bounds } from "./Bounds"

describe("basics", () => {
    it("can report the center", () => {
        const bounds = new Bounds(0, 0, 100, 100)
        expect(bounds.centerX).toEqual(50)
    })
})

describe("split", () => {
    it("can split a bounds into correct number of pieces", () => {
        const bounds = new Bounds(0, 0, 100, 100)
        const quads = bounds.split(4)
        expect(quads.length).toEqual(4)
        const second = quads[1]
        const third = quads[2]
        const fourth = quads[3]

        expect(second.x).toEqual(50)
        expect(third.y).toEqual(50)
        expect(third.x).toEqual(0)
        expect(fourth.height).toEqual(50)
    })

    it("can add padding between charts", () => {
        const bounds = new Bounds(0, 0, 100, 100)
        const quads = bounds.split(4, { rowPadding: 20, columnPadding: 20 })
        expect(quads.length).toEqual(4)
        const second = quads[1]
        const third = quads[2]
        const fourth = quads[3]

        expect(second.x).toEqual(60)
        expect(third.y).toEqual(60)
        expect(third.x).toEqual(0)
        expect(fourth.height).toEqual(40)
    })
})
