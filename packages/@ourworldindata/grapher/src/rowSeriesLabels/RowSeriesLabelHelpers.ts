import * as _ from "lodash-es"
import { TextWrap, shortenWithEllipsis } from "@ourworldindata/components"
import { EntityName } from "@ourworldindata/types"
import { excludeUndefined } from "@ourworldindata/utils"
import { FontSettings } from "../core/GrapherConstants.js"
import {
    SeriesLabelState,
    SeriesLabelStateOptions,
} from "../seriesLabel/SeriesLabelState.js"

/** Vertical padding between the label and the annotation underneath it */
const ANNOTATION_PADDING = 2

/** Where each row's label must end, in px from the chart's left edge, when the left labels get the given width */
export type GetLabelRightEdges = (leftLabelsWidth: number) => readonly number[]

type LabelOptions = Pick<
    SeriesLabelStateOptions,
    "showRegionTooltip" | "textAnchor"
>

/** A row's label, and whether it overflows its row */
interface FittedLabel {
    label: SeriesLabelState
    narrowWidth: number
    needsTruncation: boolean
}

/** A row's annotation, and whether it overflows the space under its label */
interface FittedAnnotation {
    textWrap: TextWrap
    needsTruncation: boolean
}

/** Centers the label/annotation block on y */
export function computeCenteredLabelYPositions({
    y,
    label,
    annotation,
}: {
    y: number
    label: { height: number }
    annotation?: { height: number }
}): { labelY: number; annotationY: number | undefined } {
    const annotationHeight = annotation
        ? ANNOTATION_PADDING + annotation.height
        : 0
    const totalHeight = label.height + annotationHeight

    // Center the combined label + annotation block on y
    const labelY = y - totalHeight / 2
    const annotationY = annotation
        ? labelY + label.height + ANNOTATION_PADDING
        : undefined

    return { labelY, annotationY }
}

/**
 * Creates a TextWrap for row-series labels that fits within the row height.
 *
 * Strategy:
 * 1. Calculate the maximum number of lines that can fit in the row height
 * 2. Use binary search to find the minimum width that produces at most maxLines
 * 3. If the label doesn't fit even at maxWidth, reduce font size until it fits
 * 4. If the label still doesn't fit, truncate the label with ellipsis
 */
function wrapLabelForHeight({
    label,
    availableHeight,
    minWidth,
    maxWidth,
    fontSettings,
}: {
    label: string
    availableHeight: number
    minWidth: number
    maxWidth: number
    fontSettings: { fontSize: number; fontWeight: number; lineHeight: number }
}): { textWrap: TextWrap; needsTruncation?: boolean } {
    const originalFontSize = fontSettings.fontSize

    // Drop new line characters before processing
    const cleanedLabel = label.replace(/\n/g, " ").trim()

    // Helper to calculate max lines that can fit in available height
    const computeMaxLineCount = (
        availableHeight: number,
        fontSettings: FontSettings
    ): number => {
        const lineHeight = fontSettings.fontSize * fontSettings.lineHeight
        return Math.max(1, Math.floor(availableHeight / lineHeight))
    }

    // Helper to create TextWrap with given width and font size
    const makeTextWrap = (maxWidth: number, fontSize: number): TextWrap =>
        new TextWrap({
            text: cleanedLabel,
            maxWidth,
            ...fontSettings,
            fontSize, // Overrides the original font size
        })

    // Calculate max lines that can fit in the row height
    const maxLines = computeMaxLineCount(availableHeight, fontSettings)

    // Find the minimum width that produces at most maxLines
    const optimalWidth = findMinWidthForMaxLines({
        label: cleanedLabel,
        maxLines,
        minWidth,
        maxWidth,
        fontSettings,
    })

    // Check if it fits at the best width with original font size
    const labelWrap = makeTextWrap(optimalWidth, originalFontSize)
    if (labelWrap.lines.length <= maxLines) return { textWrap: labelWrap }

    // If not, reduce the font size until it fits (or the minimum font size is reached)
    const minFontSize = Math.max(Math.floor(originalFontSize * 0.8), 6)
    const optimalFontSize = findMaxFontSizeForHeight({
        label: cleanedLabel,
        maxWidth,
        availableHeight,
        maxFontSize: originalFontSize,
        minFontSize,
        fontSettings,
    })

    // Check if the label fits or if it needs truncation
    const reducedFontWrap = makeTextWrap(maxWidth, optimalFontSize)
    const optimalFontSettings = { ...fontSettings, fontSize: optimalFontSize }
    const maxLinesAtReducedSize = computeMaxLineCount(
        availableHeight,
        optimalFontSettings
    )
    const needsTruncation = reducedFontWrap.lines.length > maxLinesAtReducedSize

    return { textWrap: reducedFontWrap, needsTruncation }
}

/** Binary search to find the minimum width that produces at most maxLines */
function findMinWidthForMaxLines({
    label,
    maxLines,
    minWidth,
    maxWidth,
    fontSettings,
}: {
    label: string
    maxLines: number
    minWidth: number
    maxWidth: number
    fontSettings: FontSettings
}): number {
    let low = minWidth
    let high = maxWidth
    let bestWidth = maxWidth
    const step = 1

    while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const testWrap = new TextWrap({
            text: label,
            maxWidth: mid,
            ...fontSettings,
        })

        if (testWrap.lines.length <= maxLines) {
            // This width works, try smaller
            bestWidth = mid
            high = mid - step
        } else {
            // Too many lines, need larger width
            low = mid + step
        }
    }

    return bestWidth
}

/** Decrease font size until the label fits within availableHeight at maxWidth */
function findMaxFontSizeForHeight({
    label,
    maxWidth,
    availableHeight,
    maxFontSize,
    minFontSize,
    fontSettings,
}: {
    label: string
    maxWidth: number
    availableHeight: number
    maxFontSize: number
    minFontSize: number
    fontSettings: FontSettings
}): number {
    const step = 0.5

    let fontSize = maxFontSize

    while (fontSize >= minFontSize) {
        const lineHeight = fontSize * fontSettings.lineHeight
        const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight))

        const testWrap = new TextWrap({
            text: label,
            maxWidth,
            ...fontSettings,
            fontSize,
        })

        if (testWrap.lines.length <= maxLines) return fontSize

        fontSize -= step
    }

    return minFontSize
}

/** The narrowest width for the left labels at which every label ends before its row's right edge */
export function findLeftLabelsWidth(
    getLabelRightEdges: GetLabelRightEdges,
    labelWidths: readonly number[]
): number {
    // Each row's right edge is a line in the left labels width; sample it at 0 and 1
    const intercepts = getLabelRightEdges(0)
    const slopes = getLabelRightEdges(1).map(
        (rightEdge, index) => rightEdge - intercepts[index]
    )
    const requiredWidths = labelWidths.map((labelWidth, index) =>
        slopes[index] > 0 ? (labelWidth - intercepts[index]) / slopes[index] : 0
    )
    return Math.max(0, ...requiredWidths)
}

/** Processes series to create sized labels that fit within available height */
export function enrichSeriesWithLabels<
    TSeries extends {
        entityName: EntityName
        shortEntityName?: string
        annotation?: string
    },
>({
    series,
    availableHeightPerSeries,
    minLabelWidth,
    maxLabelWidth,
    getLabelRightEdges = (leftLabelsWidth) => series.map(() => leftLabelsWidth),
    fontSettings,
    annotationFontSettings = {
        fontSize: 0.9 * fontSettings.fontSize,
        fontWeight: 300,
        lineHeight: 1,
    },
    showRegionTooltip = false,
}: {
    series: readonly TSeries[]
    availableHeightPerSeries: number
    minLabelWidth: number
    maxLabelWidth: number
    /** Defaults to every label ending at the left labels width */
    getLabelRightEdges?: GetLabelRightEdges
    fontSettings: FontSettings
    annotationFontSettings?: FontSettings
    showRegionTooltip?: boolean
}): (TSeries & { label: SeriesLabelState; annotationTextWrap?: TextWrap })[] {
    const labelOptions = { showRegionTooltip, textAnchor: "end" } as const

    const narrowWraps = series.map((series) =>
        wrapLabelForHeight({
            label: series.shortEntityName ?? series.entityName,
            availableHeight: availableHeightPerSeries,
            minWidth: minLabelWidth,
            maxWidth: maxLabelWidth,
            fontSettings,
        })
    )

    const labels = widenLabels({
        narrowWraps,
        getLabelRightEdges,
        maxLabelWidth,
        labelOptions,
    })

    const annotations = series.map((series, index) =>
        series.annotation
            ? fitAnnotation({
                  text: series.annotation,
                  labelHeight: labels[index].label.height,
                  // 80px extra to give annotations more room than labels
                  firstTryWidth: labels[index].narrowWidth + 80,
                  availableHeight: availableHeightPerSeries,
                  maxWidth: maxLabelWidth,
                  fontSettings: annotationFontSettings,
              })
            : undefined
    )

    const truncationWidth = computeTruncationWidth(labels, annotations)

    return series.map((series, index) => {
        const { label, needsTruncation } = labels[index]
        const annotation = annotations[index]
        return {
            ...series,
            label: needsTruncation
                ? SeriesLabelState.fromTextWrap(
                      truncateText(label.text, truncationWidth, fontSettings),
                      labelOptions
                  )
                : label,
            annotationTextWrap: annotation?.needsTruncation
                ? truncateText(
                      annotation.textWrap.text,
                      truncationWidth,
                      annotationFontSettings
                  )
                : annotation?.textWrap,
        }
    })
}

/** Widens each narrow label as far as it can go without increasing the left labels width */
function widenLabels({
    narrowWraps,
    getLabelRightEdges,
    maxLabelWidth,
    labelOptions,
}: {
    narrowWraps: readonly { textWrap: TextWrap; needsTruncation?: boolean }[]
    getLabelRightEdges: GetLabelRightEdges
    maxLabelWidth: number
    labelOptions: LabelOptions
}): FittedLabel[] {
    const narrowLabels = narrowWraps.map(({ textWrap }) =>
        SeriesLabelState.fromTextWrap(textWrap, labelOptions)
    )

    const narrowWidths = narrowWraps.map(({ needsTruncation }, index) =>
        needsTruncation ? 0 : narrowLabels[index].width
    )
    const rightEdges = getLabelRightEdges(
        findLeftLabelsWidth(getLabelRightEdges, narrowWidths)
    )

    return narrowWraps.map(({ textWrap, needsTruncation = false }, index) => {
        const narrowLabel = narrowLabels[index]
        const label = needsTruncation
            ? narrowLabel
            : widenLabel({
                  narrowLabel,
                  narrowWrap: textWrap,
                  budget: rightEdges[index],
                  maxLabelWidth,
                  labelOptions,
              })
        return { label, narrowWidth: textWrap.width, needsTruncation }
    })
}

/** Re-wraps a label to fewer rendered lines if that fits within its budget */
function widenLabel({
    narrowLabel,
    narrowWrap,
    budget,
    maxLabelWidth,
    labelOptions,
}: {
    narrowLabel: SeriesLabelState
    narrowWrap: TextWrap
    budget: number
    maxLabelWidth: number
    labelOptions: LabelOptions
}): SeriesLabelState {
    if (narrowLabel.spanLines.length === 1) return narrowLabel

    const maxWidth = Math.min(budget, maxLabelWidth)
    if (maxWidth <= narrowWrap.maxWidth) return narrowLabel

    const textWrap = new TextWrap({
        text: narrowWrap.text,
        maxWidth,
        fontSize: narrowWrap.fontSize,
        fontWeight: narrowWrap.fontWeight,
        lineHeight: narrowWrap.lineHeight,
    })
    const label = SeriesLabelState.fromTextWrap(textWrap, labelOptions)

    const hasFewerLines = label.spanLines.length < narrowLabel.spanLines.length
    const fitsBudget = label.width <= budget
    return hasFewerLines && fitsBudget ? label : narrowLabel
}

/** Wraps an annotation into the space left under its label, or returns undefined if not even one line fits */
function fitAnnotation({
    text,
    labelHeight,
    firstTryWidth,
    availableHeight,
    maxWidth,
    fontSettings,
}: {
    text: string
    labelHeight: number
    firstTryWidth: number
    availableHeight: number
    maxWidth: number
    fontSettings: FontSettings
}): FittedAnnotation | undefined {
    // 4px extra padding to avoid crowding
    const heightLeft = availableHeight - labelHeight - ANNOTATION_PADDING - 4
    if (heightLeft < fontSettings.fontSize * fontSettings.lineHeight) return

    const textWrap = new TextWrap({
        text,
        maxWidth: Math.min(maxWidth, firstTryWidth),
        ...fontSettings,
    })
    if (textWrap.height <= heightLeft)
        return { textWrap, needsTruncation: false }

    const wideTextWrap = new TextWrap({ text, maxWidth, ...fontSettings })
    return {
        textWrap: wideTextWrap,
        needsTruncation: wideTextWrap.height > heightLeft,
    }
}

/** The width of the widest label or annotation that fits its row */
function computeTruncationWidth(
    labels: readonly FittedLabel[],
    annotations: (FittedAnnotation | undefined)[]
): number {
    const fittingWidths = [
        ...labels
            .filter((label) => !label.needsTruncation)
            .map(({ label }) => label.width),
        ...excludeUndefined(annotations)
            .filter((annotation) => !annotation.needsTruncation)
            .map(({ textWrap }) => textWrap.width),
    ]
    return _.max(fittingWidths) ?? 0
}

/** Shortens text with an ellipsis to the given width, on a single line */
function truncateText(
    text: string,
    width: number,
    fontSettings: FontSettings
): TextWrap {
    return new TextWrap({
        text: shortenWithEllipsis(text, width, fontSettings),
        maxWidth: Infinity,
        ...fontSettings,
    })
}
