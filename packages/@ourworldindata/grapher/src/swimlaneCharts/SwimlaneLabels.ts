import { SwimlaneSegmentLabels, Time } from "@ourworldindata/types"
import { textWidth } from "../chart/ChartUtils"
import { FontSettings } from "../core/GrapherConstants"
import { SEGMENT_LABEL_PADDING } from "./SwimlaneChartConstants"

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

/** Whether a segment has room for its category above its time range */
export function shouldLabelSegment({
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
}): boolean {
    if (segmentLabels === SwimlaneSegmentLabels.None) return false

    const availableWidth = width - 2 * SEGMENT_LABEL_PADDING
    const lineHeight = fontSettings.fontSize * fontSettings.lineHeight
    const widestLine = Math.max(
        textWidth(category, fontSettings),
        textWidth(timeRange, fontSettings)
    )

    return height >= 2 * lineHeight && availableWidth >= widestLine
}
