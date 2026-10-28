import { describe, expect, it } from "vitest"
import { AnnotationTooltipState } from "./LineChartConstants"
import {
    toSeriesLabelAnnotations,
    transitionAnnotationTooltipState,
} from "./LineChartHelpers"
import {
    PointAnnotation,
    RangeAnnotation,
} from "../annotations/EntityAnnotations"
import { OwidTable } from "@ourworldindata/core-table"

const markerOpen: AnnotationTooltipState = {
    kind: "markerOpen",
    seriesName: "France",
    time: 2000,
}

describe(transitionAnnotationTooltipState, () => {
    it("opens a marker tooltip on click", () => {
        expect(
            transitionAnnotationTooltipState(
                { kind: "idle" },
                { type: "markerClick", seriesName: "France", time: 2000 }
            )
        ).toEqual(markerOpen)
    })

    it("closes the tooltip when its marker is clicked again", () => {
        expect(
            transitionAnnotationTooltipState(markerOpen, {
                type: "markerClick",
                seriesName: "France",
                time: 2000,
            })
        ).toEqual({ kind: "idle" })
    })

    it("moves the tooltip to another marker of the same series", () => {
        expect(
            transitionAnnotationTooltipState(markerOpen, {
                type: "markerClick",
                seriesName: "France",
                time: 2010,
            })
        ).toEqual({ kind: "markerOpen", seriesName: "France", time: 2010 })
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

describe(toSeriesLabelAnnotations, () => {
    const point = (text: string, time: number): PointAnnotation => ({
        timeScope: "point",
        entityNames: ["France"],
        text,
        time,
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
