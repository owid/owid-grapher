#! /usr/bin/env yarn jest

import { getSegmentsFromPoints } from "grapher/scatterCharts/MultiColorPolyline"

describe(getSegmentsFromPoints, () => {
    it("splits different-colored segments", () => {
        const points = [
            { x: 0, y: 0, color: "#000" },
            { x: 1, y: 0, color: "#111" },
        ]
        const segments = getSegmentsFromPoints(points)

        expect(segments.length).toEqual(2)

        expect(segments[0].color).toEqual("#000")
        expect(segments[0].points[0]).toEqual({ x: 0, y: 0 })
        expect(segments[0].points[1]).toEqual({ x: 0.5, y: 0 })

        expect(segments[1].color).toEqual("#111")
        expect(segments[1].points[0]).toEqual({ x: 0.5, y: 0 })
        expect(segments[1].points[1]).toEqual({ x: 1, y: 0 })
    })

    it("preserves same-colored segments", () => {
        const points = [
            { x: 0, y: 0, color: "#000" },
            { x: 1, y: 0, color: "#000" },
        ]
        const segments = getSegmentsFromPoints(points)

        expect(segments.length).toEqual(1)
        expect(segments[0].color).toEqual("#000")
        expect(segments[0].points[0]).toEqual({ x: 0, y: 0 })
        expect(segments[0].points[1]).toEqual({ x: 1, y: 0 })
    })

    it("merges segments of same color", () => {
        const points = [
            { x: 0, y: 0, color: "#000" },
            { x: 1, y: 0, color: "#000" },
            { x: 5, y: 3, color: "#000" },
            { x: 5, y: 4, color: "#111" },
            { x: 6, y: 4, color: "#000" },
        ]
        const segments = getSegmentsFromPoints(points)

        expect(segments.length).toEqual(3)

        expect(segments[0].color).toEqual("#000")
        expect(segments[1].color).toEqual("#111")
        expect(segments[2].color).toEqual("#000")

        expect(segments[0].points.length).toEqual(4)
        expect(segments[1].points.length).toEqual(3)
        expect(segments[2].points.length).toEqual(2)
    })
})
