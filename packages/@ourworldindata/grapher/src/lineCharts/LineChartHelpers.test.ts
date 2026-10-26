import { describe, expect, it } from "vitest"
import { AnnotationTooltipState } from "./LineChartConstants"
import { transitionAnnotationTooltipState } from "./LineChartHelpers"

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
