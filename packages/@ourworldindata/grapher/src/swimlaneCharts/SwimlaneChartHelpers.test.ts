import { describe, expect, it } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { Time } from "@ourworldindata/types"
import { SeriesLabelState } from "../seriesLabel/SeriesLabelState"
import { FocusArray } from "../focus/FocusArray"
import { CategoricalBin } from "../color/ColorScaleBin"
import { NO_DATA_LABEL } from "../color/ColorScale"
import { Emphasis } from "../interaction/Emphasis"
import {
    ColoredSwimlaneSegment,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
} from "./SwimlaneChartConstants"
import {
    findLaneAtY,
    findSegmentAtX,
    toPlacedSwimlaneSeries,
    toRenderSwimlaneSeries,
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
        categoryLabel: category,
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

        expect(lanes.map((lane) => lane.slotHeight)).toEqual(Array(20).fill(20))
        expect(lanes[0].y).toBeCloseTo(10)
        expect(lanes[19].y).toBeCloseTo(390)
    })
})

describe("hit-testing", () => {
    const [france, germany] = placeLanes([
        makeSizedSeries("France", [
            makeCategorySegment("X", 2000, 2001),
            makeCategorySegment("Y", 2002, 2003),
        ]),
        makeSizedSeries("Germany", [makeCategorySegment("X", 2000, 2003)]),
    ])
    const [x, y] = france.placedSegments

    it("finds a segment from its start up to, but not including, its end", () => {
        expect(findSegmentAtX(france.placedSegments, 0)).toBe(x)
        expect(findSegmentAtX(france.placedSegments, 19.9)).toBe(x)
        expect(findSegmentAtX(france.placedSegments, 20)).toBe(y)
    })

    it("finds no segment before the first or after the last", () => {
        expect(findSegmentAtX(france.placedSegments, -1)).toBeUndefined()
        expect(findSegmentAtX(france.placedSegments, 40)).toBeUndefined()
    })

    it("finds a lane from the top of its slot up to, but not including, the next", () => {
        const lanes = placeLanes(
            [makeSizedSeries("France", []), makeSizedSeries("Germany", [])],
            new Bounds(0, 0, 200, 40)
        )

        expect(findLaneAtY(lanes, 0)).toBe(lanes[0])
        expect(findLaneAtY(lanes, 19.9)).toBe(lanes[0])
        expect(findLaneAtY(lanes, 20)).toBe(lanes[1])
        expect(findLaneAtY(lanes, 40)).toBeUndefined()
    })

    it("finds no lane above or below the centered block of lanes", () => {
        expect(findLaneAtY([france, germany], 100)).toBeUndefined()
        expect(findLaneAtY([france, germany], 300)).toBeUndefined()
    })
})

describe("emphasis", () => {
    const lanes = placeLanes([
        makeSizedSeries("France", [
            makeCategorySegment("X", 2000, 2001),
            makeMissingSegment(2002, 2002),
            makeCategorySegment("Y", 2003, 2003),
        ]),
        makeSizedSeries("Germany", [
            makeCategorySegment("Y", 2000, 2001),
            makeCategorySegment("X", 2002, 2003),
        ]),
    ])

    function makeBin(value: string): CategoricalBin {
        return new CategoricalBin({ index: 0, value, label: value, color: "" })
    }

    function findEmphases(
        options: Omit<Parameters<typeof toRenderSwimlaneSeries>[0], "series">
    ): { lane: Emphasis; segments: Emphasis[] }[] {
        return toRenderSwimlaneSeries({ series: lanes, ...options }).map(
            (series) => ({
                lane: series.emphasis,
                segments: series.placedSegments.map(
                    (segment) => segment.emphasis
                ),
            })
        )
    }

    const { Default, Highlighted, Muted } = Emphasis

    it("is default everywhere without hover or focus, also when hovering past the last segment", () => {
        const expected = [
            { lane: Default, segments: [Default, Default, Default] },
            { lane: Default, segments: [Default, Default] },
        ]

        expect(findEmphases({ focusArray: new FocusArray() })).toEqual(expected)
        expect(
            findEmphases({
                focusArray: new FocusArray(),
                hoveredPoint: { x: 100, laneEntityName: "France" },
            })
        ).toEqual(expected)
    })

    it("highlights the hovered segment and mutes every other segment in every lane", () => {
        expect(
            findEmphases({
                focusArray: new FocusArray(),
                hoveredPoint: { x: 5, laneEntityName: "France" },
            })
        ).toEqual([
            { lane: Default, segments: [Highlighted, Muted, Muted] },
            { lane: Default, segments: [Muted, Muted] },
        ])
    })

    it("highlights a hovered legend category in every lane", () => {
        expect(
            findEmphases({
                focusArray: new FocusArray(),
                hoveredLegendBin: makeBin("X"),
            })
        ).toEqual([
            { lane: Default, segments: [Highlighted, Muted, Muted] },
            { lane: Default, segments: [Muted, Highlighted] },
        ])
    })

    it("highlights only missing segments for the no-data legend bin", () => {
        expect(
            findEmphases({
                focusArray: new FocusArray(),
                hoveredLegendBin: makeBin(NO_DATA_LABEL),
            })
        ).toEqual([
            { lane: Default, segments: [Muted, Highlighted, Muted] },
            { lane: Default, segments: [Muted, Muted] },
        ])
    })

    it("highlights a focused lane and mutes the others", () => {
        expect(
            findEmphases({ focusArray: new FocusArray().add("Germany") })
        ).toEqual([
            { lane: Muted, segments: [Muted, Muted, Muted] },
            { lane: Highlighted, segments: [Highlighted, Highlighted] },
        ])
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
