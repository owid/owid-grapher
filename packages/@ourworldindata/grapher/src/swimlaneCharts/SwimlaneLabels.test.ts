import { describe, expect, it } from "vitest"

import { SwimlaneSegmentLabels } from "@ourworldindata/types"
import { textWidth } from "../chart/ChartUtils"
import { FontSettings } from "../core/GrapherConstants"
import { SEGMENT_LABEL_PADDING } from "./SwimlaneChartConstants"
import { chooseSegmentLabel, formatSegmentTimeRange } from "./SwimlaneLabels"

const FONT_SETTINGS: FontSettings = {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.2,
}
const LINE_HEIGHT = FONT_SETTINGS.fontSize * FONT_SETTINGS.lineHeight

describe(chooseSegmentLabel, () => {
    it("returns twoLines for a wide, tall segment", () => {
        const category = "High income"
        const timeRange = "1789–1795"
        const width =
            Math.max(
                textWidth(category, FONT_SETTINGS),
                textWidth(timeRange, FONT_SETTINGS)
            ) +
            2 * SEGMENT_LABEL_PADDING +
            20
        const height = 2 * LINE_HEIGHT + 10

        expect(
            chooseSegmentLabel({
                segmentLabels: SwimlaneSegmentLabels.CategoryAndTimeRange,
                category,
                timeRange,
                width,
                height,
                fontSettings: FONT_SETTINGS,
            })
        ).toEqual({ kind: "twoLines", category, timeRange })
    })

    it("falls to categoryOnly when the width holds the category but not the time range, at a two-line height", () => {
        const category = "Low"
        const timeRange = "1789–1795"
        const width =
            textWidth(category, FONT_SETTINGS) + 2 * SEGMENT_LABEL_PADDING + 5
        const height = 2 * LINE_HEIGHT + 10

        expect(
            chooseSegmentLabel({
                segmentLabels: SwimlaneSegmentLabels.CategoryAndTimeRange,
                category,
                timeRange,
                width,
                height,
                fontSettings: FONT_SETTINGS,
            })
        ).toEqual({ kind: "categoryOnly", category })
    })

    it("returns oneLine for a short, wide segment", () => {
        const category = "High income"
        const timeRange = "1789–1795"
        const oneLineText = `${category}, ${timeRange}`
        const width =
            textWidth(oneLineText, FONT_SETTINGS) +
            2 * SEGMENT_LABEL_PADDING +
            20
        const height = LINE_HEIGHT + 5

        expect(
            chooseSegmentLabel({
                segmentLabels: SwimlaneSegmentLabels.CategoryAndTimeRange,
                category,
                timeRange,
                width,
                height,
                fontSettings: FONT_SETTINGS,
            })
        ).toEqual({ kind: "oneLine", text: oneLineText })
    })

    it("returns categoryOnly for a short, narrow segment", () => {
        const category = "Low income"
        const timeRange = "1789–1795"
        const width =
            textWidth(category, FONT_SETTINGS) + 2 * SEGMENT_LABEL_PADDING + 5
        const height = LINE_HEIGHT + 5

        expect(
            chooseSegmentLabel({
                segmentLabels: SwimlaneSegmentLabels.CategoryAndTimeRange,
                category,
                timeRange,
                width,
                height,
                fontSettings: FONT_SETTINGS,
            })
        ).toEqual({ kind: "categoryOnly", category })
    })

    it("returns none for a category longer than any plausible segment", () => {
        const category =
            "An implausibly long category name that no segment could ever fit"
        const timeRange = "1789–1795"
        const width =
            textWidth("Short", FONT_SETTINGS) + 2 * SEGMENT_LABEL_PADDING
        const height = 2 * LINE_HEIGHT + 10

        expect(
            chooseSegmentLabel({
                segmentLabels: SwimlaneSegmentLabels.CategoryAndTimeRange,
                category,
                timeRange,
                width,
                height,
                fontSettings: FONT_SETTINGS,
            })
        ).toEqual({ kind: "none" })
    })

    it("returns none whatever the space when segmentLabels is none", () => {
        expect(
            chooseSegmentLabel({
                segmentLabels: SwimlaneSegmentLabels.None,
                category: "High income",
                timeRange: "1789–1795",
                width: 10000,
                height: 10000,
                fontSettings: FONT_SETTINGS,
            })
        ).toEqual({ kind: "none" })
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
