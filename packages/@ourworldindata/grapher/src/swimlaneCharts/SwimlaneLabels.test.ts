import { describe, expect, it } from "vitest"

import { SwimlaneSegmentLabels } from "@ourworldindata/types"
import { textWidth } from "../chart/ChartUtils"
import { FontSettings } from "../core/GrapherConstants"
import { shouldLabelSegment } from "./SwimlaneLabels"

describe(shouldLabelSegment, () => {
    const fontSettings: FontSettings = {
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1.2,
    }
    const twoLinesHeight = 2 * 12 * 1.2
    const padding = 2 * 8

    const category = "Monarchy"
    const timeRange = "2000–2002"
    const widestLine = Math.max(
        textWidth(category, fontSettings),
        textWidth(timeRange, fontSettings)
    )

    function shouldLabel(
        size: { width: number; height: number },
        segmentLabels = SwimlaneSegmentLabels.CategoryAndTimeRange
    ): boolean {
        return shouldLabelSegment({
            segmentLabels,
            category,
            timeRange,
            fontSettings,
            ...size,
        })
    }

    it("labels a segment with room for both lines and their padding", () => {
        expect(
            shouldLabel({
                width: widestLine + padding,
                height: twoLinesHeight,
            })
        ).toBe(true)
    })

    it("skips a segment that is too narrow for the wider line", () => {
        expect(
            shouldLabel({
                width: widestLine + padding - 1,
                height: twoLinesHeight,
            })
        ).toBe(false)
    })

    it("measures the time range when it is wider than the category", () => {
        expect(
            shouldLabelSegment({
                segmentLabels: SwimlaneSegmentLabels.CategoryAndTimeRange,
                category: "X",
                timeRange,
                fontSettings,
                width: textWidth("X", fontSettings) + padding,
                height: twoLinesHeight,
            })
        ).toBe(false)
    })

    it("skips a segment that is too short for two lines", () => {
        expect(
            shouldLabel({
                width: widestLine + padding,
                height: twoLinesHeight - 0.1,
            })
        ).toBe(false)
    })

    it("never labels when segment labels are turned off", () => {
        expect(
            shouldLabel(
                { width: 1000, height: 1000 },
                SwimlaneSegmentLabels.None
            )
        ).toBe(false)
    })
})
