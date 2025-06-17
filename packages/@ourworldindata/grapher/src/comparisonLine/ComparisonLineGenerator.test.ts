import { expect, it, describe } from "vitest"

import {
    evalFormula,
    generateComparisonLinePoints,
    parseEquation,
} from "./ComparisonLineGenerator"
import { ScaleType } from "@ourworldindata/types"

describe("formula parsing & evaluation", () => {
    it("should parse and evaluate a simple formula", () => {
        const formula = "10 * (x - 1950)"
        const parsed = parseEquation(formula)
        expect(parsed).toBeDefined()

        const result = evalFormula(parsed, { x: 2000 }, undefined)
        expect(result).toEqual(500)
    })

    it("should handle advanced math symbols", () => {
        const formula = "sin(PI/2) + ln(e) + log10(x)^2 / sqrt(4)"
        const parsed = parseEquation(formula)
        expect(parsed).toBeDefined()

        const result = evalFormula(parsed, { x: 1000 }, undefined)
        expect(result).toEqual(6.5)
    })
})

describe("For y = x", () => {
    it("returns the correct number of points", () => {
        const points = generateComparisonLinePoints(
            "x",
            [0, 10],
            [0, 10],
            ScaleType.linear,
            ScaleType.linear
        )
        expect(points.length).toEqual(500)
    })

    it("it clamps points if they exceed the y max", () => {
        const points = generateComparisonLinePoints(
            "x",
            [0, 10],
            [0, 5],
            ScaleType.linear,
            ScaleType.linear
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
            ScaleType.linear,
            ScaleType.linear
        )
        expect(points.length).toEqual(11)
    })

    it("returns the correct number of points for a log chart", () => {
        const points = generateComparisonLinePoints(
            "50*x",
            [1e-6, 1e6],
            [0, 10],
            ScaleType.log,
            ScaleType.linear
        )
        expect(points.length).toEqual(221)
    })
})
