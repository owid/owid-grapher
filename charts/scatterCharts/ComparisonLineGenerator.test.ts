#! /usr/bin/env yarn jest

import { generateComparisonLinePoints } from "./ComparisonLineGenerator"

describe(generateComparisonLinePoints, () => {
    describe("For y = x", () => {
        it("returns the correct number of points", () => {
            const points = generateComparisonLinePoints(
                "x",
                [0, 10],
                [0, 10],
                "linear",
                "linear"
            )
            expect(points.length).toEqual(500)
        })

        it("it clamps points if they exceed the y max", () => {
            const points = generateComparisonLinePoints(
                "x",
                [0, 10],
                [0, 5],
                "linear",
                "linear"
            )
            expect(points.length).toEqual(251)
        })
    })

    describe("For y = 50*x", () => {
        it("returns the correct number of points", () => {
            const points = generateComparisonLinePoints(
                "50*x",
                [0, 10],
                [0, 10],
                "linear",
                "linear"
            )
            expect(points.length).toEqual(11)
        })

        it("returns the correct number of points for a log chart", () => {
            const points = generateComparisonLinePoints(
                "50*x",
                [1e-6, 1e6],
                [0, 10],
                "log",
                "linear"
            )
            expect(points.length).toEqual(221)
        })
    })
})
