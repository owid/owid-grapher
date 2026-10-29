import { describe, expect, it } from "vitest"
import {
    AnnotationTooltipState,
    PlacedPoint,
    RANGE_ANNOTATION_OUTLINE_WIDTH,
    RANGE_ANNOTATION_TOOLTIP_MARGIN,
    PlaceRangeAnnotationTooltipArgs,
} from "./LineChartConstants"
import {
    placeRangeAnnotation,
    placeRangeAnnotationTooltip,
    toSeriesLabelAnnotations,
    transitionAnnotationTooltipState,
} from "./LineChartHelpers"
import {
    PointAnnotation,
    RangeAnnotation,
} from "../annotations/EntityAnnotations"
import { OwidTable } from "@ourworldindata/core-table"
import { Bounds, PointVector } from "@ourworldindata/utils"

const markerOpen: AnnotationTooltipState = {
    kind: "markerOpen",
    seriesName: "France",
    marker: { timeScope: "point", time: 2000 },
}

describe(transitionAnnotationTooltipState, () => {
    it("opens a marker tooltip on click", () => {
        expect(
            transitionAnnotationTooltipState(
                { kind: "idle" },
                {
                    type: "markerClick",
                    seriesName: "France",
                    marker: { timeScope: "point", time: 2000 },
                }
            )
        ).toEqual(markerOpen)
    })

    it("closes the tooltip when its marker is clicked again", () => {
        expect(
            transitionAnnotationTooltipState(markerOpen, {
                type: "markerClick",
                seriesName: "France",
                marker: { timeScope: "point", time: 2000 },
            })
        ).toEqual({ kind: "idle" })
    })

    it("moves the tooltip to another marker of the same series", () => {
        expect(
            transitionAnnotationTooltipState(markerOpen, {
                type: "markerClick",
                seriesName: "France",
                marker: { timeScope: "point", time: 2010 },
            })
        ).toEqual({
            kind: "markerOpen",
            seriesName: "France",
            marker: { timeScope: "point", time: 2010 },
        })
    })

    it("tells a range marker from a point marker at its start time", () => {
        const rangeMarker = {
            timeScope: "range",
            startTime: 2000,
            endTime: 2010,
        } as const
        expect(
            transitionAnnotationTooltipState(markerOpen, {
                type: "markerClick",
                seriesName: "France",
                marker: rangeMarker,
            })
        ).toEqual({
            kind: "markerOpen",
            seriesName: "France",
            marker: rangeMarker,
        })
    })

    it("replaces an open marker tooltip with a label tooltip", () => {
        expect(
            transitionAnnotationTooltipState(markerOpen, {
                type: "labelTooltipShow",
                seriesName: "Spain",
            })
        ).toEqual({ kind: "labelOpen", seriesName: "Spain" })
    })

    it("ignores hide and close events that do not match the open tooltip", () => {
        const labelOpen: AnnotationTooltipState = {
            kind: "labelOpen",
            seriesName: "France",
        }
        expect(
            transitionAnnotationTooltipState(labelOpen, {
                type: "labelTooltipHide",
                seriesName: "Spain",
            })
        ).toBe(labelOpen)
        expect(
            transitionAnnotationTooltipState(labelOpen, {
                type: "markerTooltipClose",
            })
        ).toBe(labelOpen)
        expect(
            transitionAnnotationTooltipState(markerOpen, {
                type: "labelTooltipHide",
                seriesName: "France",
            })
        ).toBe(markerOpen)
    })
})

const range = (
    text: string,
    startTime: number,
    endTime: number
): RangeAnnotation => ({
    timeScope: "range",
    entityNames: ["France"],
    text,
    startTime,
    endTime,
})

describe(toSeriesLabelAnnotations, () => {
    const point = (text: string, time: number): PointAnnotation => ({
        timeScope: "point",
        entityNames: ["France"],
        text,
        time,
    })

    it("merges points and ranges by start time, points first on a tie", () => {
        const entries = toSeriesLabelAnnotations(
            {
                pointAnnotations: [
                    point("point 2000", 2000),
                    point("point 1990", 1990),
                ],
                rangeAnnotations: [
                    range("range 2000", 2000, 2005),
                    range("range 1985", 1985, 2005),
                ],
            },
            new OwidTable({ year: [2000], value: [1] }).timeColumn
        )

        expect(entries).toEqual([
            { heading: "1985 to 2005", text: "range 1985" },
            { heading: "1990", text: "point 1990" },
            { heading: "2000", text: "point 2000" },
            { heading: "2000 to 2005", text: "range 2000" },
        ])
    })
})

describe(placeRangeAnnotation, () => {
    const placedPoint = (time: number, x: number, y: number): PlacedPoint => ({
        time,
        x,
        y,
        color: "red",
    })
    const placedPoints = [
        placedPoint(2000, 0, 100),
        placedPoint(2010, 100, 0),
        placedPoint(2020, 200, 50),
        placedPoint(2030, 300, 150),
    ]

    it("keeps the data points when both ends fall on them", () => {
        const placed = placeRangeAnnotation(
            range("on data", 2010, 2020),
            placedPoints
        )

        expect(placed?.points).toEqual([placedPoints[1], placedPoints[2]])
        expect(placed?.snappedTimeRange).toEqual({
            startTime: 2010,
            endTime: 2020,
        })
    })

    it("cuts the line where both ends fall between data points", () => {
        const placed = placeRangeAnnotation(
            range("between", 2005, 2015),
            placedPoints
        )

        expect(placed?.points).toEqual([
            placedPoint(2005, 50, 50),
            placedPoints[1],
            placedPoint(2015, 150, 25),
        ])
        expect(placed?.snappedTimeRange).toEqual({
            startTime: 2000,
            endTime: 2020,
        })
    })

    it("cuts a range inside one segment at both ends", () => {
        const placed = placeRangeAnnotation(
            range("inside", 2002, 2008),
            placedPoints
        )

        expect(placed?.points).toEqual([
            placedPoint(2002, 20, 80),
            placedPoint(2008, 80, 20),
        ])
        expect(placed?.snappedTimeRange).toEqual({
            startTime: 2000,
            endTime: 2010,
        })
    })

    it("stops at the ends of the line when the range runs past them", () => {
        const placed = placeRangeAnnotation(
            range("past both ends", 1990, 2040),
            placedPoints
        )

        expect(placed?.points).toEqual(placedPoints)
        expect(placed?.snappedTimeRange).toEqual({
            startTime: 2000,
            endTime: 2030,
        })
    })

    it("keeps a range that touches the line only at its first or last point", () => {
        expect(
            placeRangeAnnotation(
                range("ends at start", 1990, 2000),
                placedPoints
            )?.points
        ).toEqual([placedPoints[0]])
        expect(
            placeRangeAnnotation(
                range("starts at end", 2030, 2040),
                placedPoints
            )?.points
        ).toEqual([placedPoints[3]])
    })

    it("returns undefined when the range misses the line", () => {
        expect(
            placeRangeAnnotation(range("before", 1980, 1990), placedPoints)
        ).toBeUndefined()
        expect(
            placeRangeAnnotation(range("after", 2040, 2050), placedPoints)
        ).toBeUndefined()
    })
})

describe(placeRangeAnnotationTooltip, () => {
    const minDistanceFromLine =
        RANGE_ANNOTATION_OUTLINE_WIDTH / 2 + RANGE_ANNOTATION_TOOLTIP_MARGIN
    const tooltipBounds = new Bounds(100, 0, 100, 40)
    const containerBounds = new Bounds(0, 0, 400, 400)
    const input = (
        overrides: Partial<PlaceRangeAnnotationTooltipArgs>
    ): PlaceRangeAnnotationTooltipArgs => ({
        points: [new PointVector(0, 200), new PointVector(300, 200)],
        clickPosition: new PointVector(150, 200),
        tooltipBounds,
        containerBounds,
        ...overrides,
    })

    it("puts the tooltip above the highest point under it", () => {
        const points = [new PointVector(100, 200), new PointVector(200, 150)]
        const placed = placeRangeAnnotationTooltip(
            input({ points, clickPosition: new PointVector(200, 150) })
        )
        expect(placed.bottom).toBe(150 - minDistanceFromLine)
        expect(placed.x).toBe(tooltipBounds.x)
    })

    it("ignores points outside the tooltip's span", () => {
        const points = [new PointVector(100, 200), new PointVector(400, 0)]
        const placed = placeRangeAnnotationTooltip(
            input({
                points,
                clickPosition: new PointVector(100, 200),
                containerBounds: containerBounds.set({ height: 240 }),
            })
        )
        const spanEnd = tooltipBounds.right + minDistanceFromLine
        const yAtSpanEnd = 200 - (200 * (spanEnd - 100)) / 300
        expect(placed.bottom).toBeCloseTo(yAtSpanEnd - minDistanceFromLine)
    })

    it("puts the tooltip below the lowest point when above overflows the container", () => {
        const points = [new PointVector(100, 30), new PointVector(200, 60)]
        const placed = placeRangeAnnotationTooltip(
            input({ points, clickPosition: new PointVector(150, 45) })
        )
        expect(placed.top).toBe(60 + minDistanceFromLine)
    })

    it("puts the tooltip below when both fit and below is much closer to the click", () => {
        const points = [new PointVector(100, 100), new PointVector(200, 300)]
        const placed = placeRangeAnnotationTooltip(
            input({ points, clickPosition: new PointVector(195, 290) })
        )
        expect(placed.top).toBe(300 + minDistanceFromLine)
    })

    it("picks the side that overflows less and clamps it to the container", () => {
        const points = [new PointVector(100, 30), new PointVector(200, 50)]
        const shortContainerBounds = containerBounds.set({ height: 90 })
        const placed = placeRangeAnnotationTooltip(
            input({
                points,
                clickPosition: new PointVector(150, 40),
                containerBounds: shortContainerBounds,
            })
        )
        expect(placed.bottom).toBe(shortContainerBounds.bottom)
    })
})
