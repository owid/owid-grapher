import { describe, expect, it } from "vitest"

import { SwimlaneSegmentLabels } from "@ourworldindata/types"
import { textWidth } from "../chart/ChartUtils"
import { FontSettings } from "../core/GrapherConstants"
import { SEGMENT_LABEL_PADDING } from "./SwimlaneChartConstants"
import { formatSegmentTimeRange, shouldLabelSegment } from "./SwimlaneLabels"

const FONT_SETTINGS: FontSettings = {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.2,
}
const LINE_HEIGHT = FONT_SETTINGS.fontSize * FONT_SETTINGS.lineHeight

const CATEGORY = "High income"
const TIME_RANGE = "1789–1795"

function widthFitting(...lines: string[]): number {
    const widest = Math.max(
        ...lines.map((line) => textWidth(line, FONT_SETTINGS))
    )
    return widest + 2 * SEGMENT_LABEL_PADDING
}

function labels({
    width,
    height,
    category = CATEGORY,
    segmentLabels = SwimlaneSegmentLabels.CategoryAndTimeRange,
}: {
    width: number
    height: number
    category?: string
    segmentLabels?: SwimlaneSegmentLabels
}): boolean {
    return shouldLabelSegment({
        segmentLabels,
        category,
        timeRange: TIME_RANGE,
        width,
        height,
        fontSettings: FONT_SETTINGS,
    })
}

describe(shouldLabelSegment, () => {
    it("labels a segment wide enough for both lines and tall enough for two", () => {
        expect(
            labels({
                width: widthFitting(CATEGORY, TIME_RANGE) + 20,
                height: 2 * LINE_HEIGHT + 10,
            })
        ).toBe(true)
    })

    it("labels a segment exactly at the width and height it needs", () => {
        expect(
            labels({
                width: widthFitting(CATEGORY, TIME_RANGE),
                height: 2 * LINE_HEIGHT,
            })
        ).toBe(true)
    })

    it("drops the label when the width holds the category but not the time range", () => {
        expect(
            labels({
                category: "Low",
                width: widthFitting("Low") + 5,
                height: 2 * LINE_HEIGHT + 10,
            })
        ).toBe(false)
    })

    it("drops the label when the height holds one line but not two", () => {
        expect(
            labels({
                width: widthFitting(CATEGORY, TIME_RANGE) + 20,
                height: 2 * LINE_HEIGHT - 1,
            })
        ).toBe(false)
    })

    it("drops the label for a category longer than any plausible segment", () => {
        expect(
            labels({
                category:
                    "An implausibly long category name that no segment could ever fit",
                width: widthFitting("Short"),
                height: 2 * LINE_HEIGHT + 10,
            })
        ).toBe(false)
    })

    it("drops the label whatever the space when segmentLabels is none", () => {
        expect(
            labels({
                width: 10000,
                height: 10000,
                segmentLabels: SwimlaneSegmentLabels.None,
            })
        ).toBe(false)
    })
})

describe(formatSegmentTimeRange, () => {
    it("renders a single time bare", () => {
        expect(
            formatSegmentTimeRange({
                startTime: 1823,
                endTime: 1823,
                formatTime: String,
            })
        ).toEqual("1823")
    })

    it("renders a span with an en dash", () => {
        expect(
            formatSegmentTimeRange({
                startTime: 1789,
                endTime: 1795,
                formatTime: String,
            })
        ).toEqual("1789–1795")
    })
})
