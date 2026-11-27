import { describe, expect, it } from "vitest"

import {
    computeAreaPaths,
    computeTopLinePaths,
    makeXScale,
    makeYScale,
    MARGIN,
    plotRect,
} from "./chartGeometry.js"

/** The x of a path's first point */
const startX = (d: string): number => Number(/^M([\d.]+),/.exec(d)?.[1])

describe(plotRect, () => {
    it("keeps the margins, with more room at the bottom on narrow charts", () => {
        expect(plotRect(600, 400, false)).toEqual({
            left: MARGIN.left,
            right: 600 - MARGIN.right,
            top: MARGIN.top,
            bottom: 400 - MARGIN.bottom,
        })
        expect(plotRect(300, 400, true).bottom).toBeLessThan(
            plotRect(300, 400, false).bottom
        )
    })

    it("never collapses below a pixel", () => {
        const rect = plotRect(0, 0, false)
        expect(rect.right).toBe(rect.left + 1)
        expect(rect.bottom).toBe(rect.top + 1)
    })
})

describe(computeAreaPaths, () => {
    const incomes = [1, 2, 4, 8, 16]
    const xScale = makeXScale(incomes, [0, 400])
    const yScale = makeYScale(10, [100, 0])
    // Nothing until the third grid point
    const series = [{ y0: [0, 0, 0, 0, 0], y1: [0, 0, 5, 10, 5] }]

    it("starts the path where the series has height", () => {
        const [d] = computeAreaPaths(series, incomes, xScale, yScale)
        expect(startX(d)).toBeCloseTo(xScale(4))
    })

    it("draws the top edge as a line over the same range", () => {
        const [d] = computeTopLinePaths(series, incomes, xScale, yScale)
        expect(startX(d)).toBeCloseTo(xScale(4))
        // A line, not a closed area: no return along the baseline
        expect(d).not.toMatch(/Z/)
    })
})
