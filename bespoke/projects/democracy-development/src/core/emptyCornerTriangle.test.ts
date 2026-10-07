import { describe, expect, it } from "vitest"

import {
    findEmptyCornerTriangle,
    getTriangleVertices,
    type NormalizedPoint,
} from "./emptyCornerTriangle.js"

function isInside(
    point: NormalizedPoint,
    triangle: NonNullable<ReturnType<typeof findEmptyCornerTriangle>>
): boolean {
    const p = Math.abs(triangle.corner.u - point.u)
    const q = Math.abs(triangle.corner.v - point.v)
    return p / triangle.legU + q / triangle.legV < 1 - 1e-9
}

describe(findEmptyCornerTriangle, () => {
    it("fills the whole panel when there are no points", () => {
        const triangle = findEmptyCornerTriangle([], { u: 1, v: 1 })
        expect(triangle).toEqual({ corner: { u: 1, v: 1 }, legU: 1, legV: 1 })
    })

    it("never contains a point", () => {
        // Points along the diagonal, plus a few scattered ones
        const points: NormalizedPoint[] = [
            { u: 0.1, v: 0.1 },
            { u: 0.5, v: 0.5 },
            { u: 0.9, v: 0.9 },
            { u: 0.2, v: 0.8 },
            { u: 0.7, v: 0.3 },
        ]
        for (const corner of [
            { u: 0, v: 0 },
            { u: 0, v: 1 },
            { u: 1, v: 0 },
            { u: 1, v: 1 },
        ] as const) {
            const triangle = findEmptyCornerTriangle(points, corner)
            expect(triangle).toBeDefined()
            for (const point of points)
                expect(isInside(point, triangle!)).toBe(false)
        }
    })

    it("lets a point sit on the hypotenuse but never runs past the panel", () => {
        // (0.1, 0.9) lies exactly on the diagonal of the top-right half
        const triangle = findEmptyCornerTriangle([{ u: 0.1, v: 0.9 }], {
            u: 1,
            v: 1,
        })!
        expect(triangle.legU).toBeCloseTo(1, 6)
        expect(triangle.legV).toBeCloseTo(1, 6)
    })

    it("goes flat when points crowd the vertical edge", () => {
        // A column of points near the right edge, except along the top
        const points: NormalizedPoint[] = [0.1, 0.3, 0.5, 0.7].map((v) => ({
            u: 0.9,
            v,
        }))
        const triangle = findEmptyCornerTriangle(points, { u: 1, v: 1 })!
        expect(triangle.legU).toBeGreaterThan(triangle.legV)
    })

    it("gives up when a point sits in the corner", () => {
        expect(
            findEmptyCornerTriangle([{ u: 0.98, v: 0.98 }], { u: 1, v: 1 })
        ).toBeUndefined()
    })

    it("keeps a margin from the points", () => {
        const withMargin = findEmptyCornerTriangle(
            [{ u: 0.5, v: 0.5 }],
            { u: 1, v: 1 },
            { margin: 0.1 }
        )!
        const without = findEmptyCornerTriangle([{ u: 0.5, v: 0.5 }], {
            u: 1,
            v: 1,
        })!
        expect(withMargin.legU).toBeLessThan(without.legU)
    })
})

describe(getTriangleVertices, () => {
    it("walks away from the corner along both edges", () => {
        expect(
            getTriangleVertices({
                corner: { u: 1, v: 0 },
                legU: 0.4,
                legV: 0.3,
            })
        ).toEqual([
            { u: 1, v: 0 },
            { u: 0.6, v: 0 },
            { u: 1, v: 0.3 },
        ])
    })
})
