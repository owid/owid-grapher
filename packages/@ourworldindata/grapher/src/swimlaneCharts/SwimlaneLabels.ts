import { SwimlaneSegmentLabels, Time } from "@ourworldindata/types"
import { textWidth } from "../chart/ChartUtils"
import { FontSettings } from "../core/GrapherConstants"
import { SEGMENT_LABEL_PADDING } from "./SwimlaneChartConstants"

export type SwimlaneSegmentLabel =
    | { kind: "twoLines"; category: string; timeRange: string }
    | { kind: "oneLine"; text: string }
    | { kind: "categoryOnly"; category: string }
    | { kind: "none" }

export interface SwimlaneSegmentLabelSettings {
    segmentLabels: SwimlaneSegmentLabels
    fontSettings: FontSettings
    formatTime: (time: Time) => string
}

export function formatSegmentTimeRange({
    startTime,
    endTime,
    formatTime,
}: {
    startTime: Time
    endTime: Time
    formatTime: (time: Time) => string
}): string {
    if (startTime === endTime) return formatTime(startTime)
    return `${formatTime(startTime)}–${formatTime(endTime)}`
}

export function chooseSegmentLabel({
    segmentLabels,
    category,
    timeRange,
    width,
    height,
    fontSettings,
}: {
    segmentLabels: SwimlaneSegmentLabels
    category: string
    timeRange: string
    width: number
    height: number
    fontSettings: FontSettings
}): SwimlaneSegmentLabel {
    if (segmentLabels === SwimlaneSegmentLabels.None) return { kind: "none" }

    const availableWidth = width - 2 * SEGMENT_LABEL_PADDING
    const lineHeight = fontSettings.fontSize * fontSettings.lineHeight

    const categoryWidth = textWidth(category, fontSettings)
    const timeRangeWidth = textWidth(timeRange, fontSettings)
    const oneLineText = `${category}, ${timeRange}`
    const oneLineWidth = textWidth(oneLineText, fontSettings)

    if (
        height >= 2 * lineHeight &&
        availableWidth >= Math.max(categoryWidth, timeRangeWidth)
    )
        return { kind: "twoLines", category, timeRange }

    if (height >= lineHeight && availableWidth >= oneLineWidth)
        return { kind: "oneLine", text: oneLineText }

    if (height >= lineHeight && availableWidth >= categoryWidth)
        return { kind: "categoryOnly", category }

    return { kind: "none" }
}
