#! /usr/bin/env jest

import { generateComparisonLinePoints } from "../ComparisonLineGenerator"

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
            expect(points.length).toEqual(100)
        })

        it("it clamps points if they exceed the y max", () => {
            const points = generateComparisonLinePoints(
                "x",
                [0, 10],
                [0, 5],
                "linear",
                "linear"
            )
            expect(points.length).toEqual(51)
        })
    })
})
