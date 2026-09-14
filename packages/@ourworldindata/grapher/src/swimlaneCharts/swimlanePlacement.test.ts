import { expect, it, describe } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { SizedSwimlaneSeries } from "./SwimlaneChartConstants"
import { placeSwimlaneLanes } from "./swimlanePlacement"

const TIME_DOMAIN: [Time, Time] = [2000, 2004]
const BOUNDS = new Bounds(0, 0, 200, 100)

function label(): SeriesLabelState {
    return new SeriesLabelState({ text: "France", maxWidth: 100, fontSize: 12 })
}

function placeTime(time: Time): number {
    const [start, end] = TIME_DOMAIN
    return BOUNDS.left + ((time - start) / (end - start)) * BOUNDS.width
}

function series(
    overrides: Partial<SizedSwimlaneSeries> = {}
): SizedSwimlaneSeries {
    return {
        seriesName: "France",
        entityName: "France",
        color: "#123456",
        label: label(),
        segments: [
            {
                kind: "category",
                category: "A",
                color: "#123456",
                startTime: 2000,
                endTime: 2003,
                endTimeExclusive: 2004,
            },
        ],
        ...overrides,
    }
}

describe(placeSwimlaneLanes, () => {
    it("returns an empty array for no series", () => {
        expect(
            placeSwimlaneLanes({ series: [], bounds: BOUNDS, placeTime })
        ).toEqual([])
    })

    it("starts the first segment at the plot's left edge and ends the last at its right edge", () => {
        const [placed] = placeSwimlaneLanes({
            series: [series()],
            bounds: BOUNDS,
            placeTime,
        })
        const [segment] = placed.placedSegments

        expect(segment.x).toEqual(BOUNDS.left)
        expect(segment.x + segment.width).toEqual(BOUNDS.right)
    })

    it("places a one-observation segment one step wide", () => {
        const [placed] = placeSwimlaneLanes({
            series: [
                series({
                    segments: [
                        {
                            kind: "category",
                            category: "A",
                            color: "#123456",
                            startTime: 2001,
                            endTime: 2001,
                            endTimeExclusive: 2002,
                        },
                    ],
                }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
        const [segment] = placed.placedSegments
        const stepWidth = placeTime(2002) - placeTime(2001)

        expect(segment.width).toEqual(stepWidth)
    })

    it("spaces lane centres evenly and keeps every lane inside the bounds", () => {
        const placed = placeSwimlaneLanes({
            series: [
                series({ seriesName: "France", entityName: "France" }),
                series({ seriesName: "Chile", entityName: "Chile" }),
                series({ seriesName: "Japan", entityName: "Japan" }),
            ],
            bounds: BOUNDS,
            placeTime,
        })

        const centres = placed.map((series) => series.y)
        const gaps = centres.slice(1).map((y, index) => y - centres[index])

        expect(gaps[0]).toBeCloseTo(gaps[1])
        for (const segment of placed.flatMap(
            (series) => series.placedSegments
        )) {
            expect(segment.y).toBeGreaterThanOrEqual(BOUNDS.top)
            expect(segment.y + segment.height).toBeLessThanOrEqual(
                BOUNDS.bottom
            )
        }
    })

    it("places a missing segment with the same geometry as a category segment", () => {
        const [placed] = placeSwimlaneLanes({
            series: [
                series({
                    segments: [
                        {
                            kind: "missing",
                            startTime: 2000,
                            endTime: 2003,
                            endTimeExclusive: 2004,
                        },
                    ],
                }),
            ],
            bounds: BOUNDS,
            placeTime,
        })
        const [segment] = placed.placedSegments

        expect(segment.kind).toEqual("missing")
        expect(segment.x).toEqual(BOUNDS.left)
        expect(segment.x + segment.width).toEqual(BOUNDS.right)
        expect(segment.y + segment.height / 2).toEqual(placed.y)
    })
})
