import { describe, expect, it } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import {
    ColoredSwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
} from "./SwimlaneChartConstants"
import {
    toPlacedSwimlaneSeries,
    toSegmentOutlinePath,
} from "./SwimlaneChartHelpers"

const placeTime = (time: Time): number => (time - 2000) * 10

function makeCategorySegment(
    category: string,
    startTime: Time,
    endTime: Time
): ColoredSwimlaneSegment {
    return {
        kind: "category",
        category,
        startTime,
        endTime,
        runStartTime: startTime,
        runEndTime: endTime,
        color: "#000",
    }
}

function makeMissingSegment(
    startTime: Time,
    endTime: Time
): ColoredSwimlaneSegment {
    return { kind: "missing", startTime, endTime }
}

function makeSizedSeries(
    entityName: string,
    segments: ColoredSwimlaneSegment[]
): SizedSwimlaneSeries {
    return {
        seriesName: entityName,
        entityName,
        color: "#000",
        segments,
        label: new SeriesLabelState({
            text: entityName,
            maxWidth: 100,
            fontSize: 12,
        }),
    }
}

function placeLanes(
    series: SizedSwimlaneSeries[],
    bounds = new Bounds(0, 0, 200, 400)
): PlacedSwimlaneSeries[] {
    return toPlacedSwimlaneSeries({ series, bounds, placeTime })
}

describe("placement", () => {
    it("extends each segment to where the next one starts, and the last one a step past its end", () => {
        const [lane] = placeLanes([
            makeSizedSeries("France", [
                makeCategorySegment("X", 2000, 2001),
                makeMissingSegment(2002, 2003),
                makeCategorySegment("Y", 2004, 2004),
            ]),
        ])

        expect(
            lane.placedSegments.map(({ x, width }) => ({ x, width }))
        ).toEqual([
            { x: 0, width: 20 },
            { x: 20, width: 20 },
            { x: 40, width: 10 },
        ])
    })

    it("caps a lone lane at the maximum lane height and centers it", () => {
        const [lane] = placeLanes([
            makeSizedSeries("France", [makeCategorySegment("X", 2000, 2001)]),
        ])

        expect(lane.y).toBeCloseTo(200)
        expect(lane.placedSegments[0].height).toBeCloseTo(36)
        expect(lane.placedSegments[0].y).toBeCloseTo(-18)
    })

    it("splits the plot height evenly between many lanes", () => {
        const lanes = placeLanes(
            Array.from({ length: 20 }, (_, index) =>
                makeSizedSeries(`Entity ${index}`, [
                    makeCategorySegment("X", 2000, 2001),
                ])
            )
        )

        expect(lanes[1].y - lanes[0].y).toBeCloseTo(20)
        expect(lanes[0].y).toBeCloseTo(10)
        expect(lanes[19].y).toBeCloseTo(390)
    })
})

describe("segment outline", () => {
    it("points the start inward when the window crops the start", () => {
        expect(
            toSegmentOutlinePath({
                x: 0,
                y: 0,
                width: 30,
                height: 10,
                isStartCropped: true,
                isEndCropped: false,
            })
        ).toEqual("M 0,5 L 4,0 L 30,0 L 30,10 L 4,10 Z")
    })

    it("points the end outward when the window crops the end", () => {
        expect(
            toSegmentOutlinePath({
                x: 0,
                y: 0,
                width: 30,
                height: 10,
                isStartCropped: false,
                isEndCropped: true,
            })
        ).toEqual("M 0,0 L 26,0 L 30,5 L 26,10 L 0,10 Z")
    })

    it("limits the taper to a third of a narrow segment's width", () => {
        expect(
            toSegmentOutlinePath({
                x: 0,
                y: 0,
                width: 6,
                height: 10,
                isStartCropped: true,
                isEndCropped: true,
            })
        ).toEqual("M 0,5 L 2,0 L 4,0 L 6,5 L 4,10 L 2,10 Z")
    })
})
