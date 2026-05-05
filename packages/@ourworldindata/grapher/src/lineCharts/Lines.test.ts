import { expect, it } from "vitest"

import {
    getAdjacentPointGroups,
    getGapLineSegments,
    getSingletonPoints,
} from "./Lines"

it("groups line chart points by adjacent time values", () => {
    const points = [
        { x: 0, y: 0, time: 2000, color: "#000" },
        { x: 1, y: 1, time: 2001, color: "#000" },
        { x: 2, y: 2, time: 2004, color: "#000" },
        { x: 3, y: 3, time: 2005, color: "#000" },
        { x: 4, y: 4, time: 2007, color: "#000" },
    ]

    expect(getAdjacentPointGroups(points)).toEqual([
        points.slice(0, 2),
        points.slice(2, 4),
        points.slice(4, 5),
    ])
})

it("creates line segments between adjacent point groups", () => {
    const points = [
        { x: 0, y: 0, time: 2000, color: "#000" },
        { x: 1, y: 1, time: 2001, color: "#000" },
        { x: 2, y: 2, time: 2004, color: "#000" },
        { x: 3, y: 3, time: 2005, color: "#000" },
        { x: 4, y: 4, time: 2007, color: "#000" },
    ]
    const pointGroups = getAdjacentPointGroups(points)
    const adaptedColor = "oklch(from #000 calc(l * 1.5) calc(c * 0.4) h)"

    expect(getGapLineSegments(pointGroups)).toEqual([
        [
            { ...points[1], color: adaptedColor },
            { ...points[2], color: adaptedColor },
        ],
        [
            { ...points[3], color: adaptedColor },
            { ...points[4], color: adaptedColor },
        ],
    ])
})

it("finds points that are singletons in adjacent point groups", () => {
    const points = [
        { x: 0, y: 0, time: 2000, color: "#000" },
        { x: 1, y: 1, time: 2001, color: "#000" },
        { x: 2, y: 2, time: 2004, color: "#000" },
        { x: 3, y: 3, time: 2006, color: "#000" },
        { x: 4, y: 4, time: 2007, color: "#000" },
    ]
    const pointGroups = getAdjacentPointGroups(points)

    expect(getSingletonPoints(pointGroups)).toEqual([points[2]])
})
