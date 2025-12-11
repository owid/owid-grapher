import * as _ from "lodash-es"
import { TextWrap, shortenWithEllipsis } from "@ourworldindata/components"
import { EntityName } from "@ourworldindata/types"
import { FontSettings } from "./DiscreteBarChartConstants.js"

const ANNOTATION_PADDING = 2

// Pattern IDs should be unique per document (!), not just per grapher instance.
// Including the color in the id guarantees that the pattern uses the correct color,
// even if it gets resolved to a striped pattern of a different grapher instance.
export function makeProjectedDataPatternId(color: string): string {
    return `DiscreteBarChart_stripes_${color}`
}

/**
 * Creates a TextWrap for discrete bar chart labels that fits within the bar height.
 *
 * Strategy:
 * 1. Calculate the maximum number of lines that can fit in the bar height
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

    // Calculate max lines that can fit in the bar height
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
    fontSettings,
    annotationFontSettings = {
        fontSize: 13,
        fontWeight: 300,
        lineHeight: 1,
    },
}: {
    series: readonly TSeries[]
    availableHeightPerSeries: number
    minLabelWidth: number
    maxLabelWidth: number
    fontSettings: FontSettings
    annotationFontSettings?: FontSettings
}): (TSeries & { label: TextWrap; annotationTextWrap?: TextWrap })[] {
    // Wrap labels and annotations to fit within the available space
    const wrappedLabels = series.map((series) => {
        const label = series.shortEntityName ?? series.entityName

        // First, wrap the label without considering annotations
        const {
            textWrap: labelWrap,
            needsTruncation: labelWrapNeedsTruncation,
        } = wrapLabelForHeight({
            label,
            availableHeight: availableHeightPerSeries,
            minWidth: minLabelWidth,
            maxWidth: maxLabelWidth,
            fontSettings,
        })

        // If there's no annotation, we're done
        if (!series.annotation) return { labelWrap, labelWrapNeedsTruncation }

        // Calculate remaining height for annotation (4px extra padding to avoid crowding)
        const remainingHeightForAnnotation =
            availableHeightPerSeries - labelWrap.height - ANNOTATION_PADDING - 4

        // If there's not enough space for even one line of annotation, skip it
        const minAnnotationHeight =
            annotationFontSettings.fontSize * annotationFontSettings.lineHeight
        if (remainingHeightForAnnotation < minAnnotationHeight)
            return { labelWrap, labelWrapNeedsTruncation }

        // Wrap annotation to fit in remaining space
        const annotationWrap = new TextWrap({
            text: series.annotation,
            // 80px extra to give annotations more room than labels
            maxWidth: Math.min(maxLabelWidth, labelWrap.width + 80),
            ...annotationFontSettings,
        })

        // Check if annotation fits in remaining height
        if (annotationWrap.height > remainingHeightForAnnotation) {
            // Try again with a larger max width
            const annotationWrap = new TextWrap({
                text: series.annotation,
                maxWidth: maxLabelWidth,
                ...annotationFontSettings,
            })

            const annotationWrapNeedsTruncation =
                annotationWrap.height > remainingHeightForAnnotation

            return {
                labelWrap,
                labelWrapNeedsTruncation,
                annotationWrap,
                annotationWrapNeedsTruncation,
            }
        }

        return {
            labelWrap,
            annotationWrap,
            labelWrapNeedsTruncation,
            annotationWrapNeedsTruncation: false,
        }
    })

    // Return early if no labels or annotations need truncation
    const needsTruncation = wrappedLabels.some(
        (s) => s.labelWrapNeedsTruncation || s.annotationWrapNeedsTruncation
    )
    if (!needsTruncation)
        return series.map((series, index) => ({
            ...series,
            label: wrappedLabels[index].labelWrap,
            annotationTextWrap: wrappedLabels[index].annotationWrap,
        }))

    // The target width for truncation is the max width of non-truncated labels and annotations
    const nonTruncatedLabelWidths = wrappedLabels
        .filter((s) => !s.labelWrapNeedsTruncation)
        .map((s) => s.labelWrap.width)
    const nonTruncatedAnnotationWidths = wrappedLabels
        .filter(
            (s) =>
                s.annotationWrap !== undefined &&
                !s.annotationWrapNeedsTruncation
        )
        .map((s) => s.annotationWrap!.width)
    const targetWidth = Math.max(
        _.max(nonTruncatedLabelWidths) ?? 0,
        _.max(nonTruncatedAnnotationWidths) ?? 0
    )

    const truncatedLabels = wrappedLabels.map(
        ({ labelWrap, labelWrapNeedsTruncation }) => {
            if (!labelWrapNeedsTruncation) return labelWrap

            const truncatedText = shortenWithEllipsis(
                labelWrap.text,
                targetWidth,
                fontSettings
            )

            return new TextWrap({
                text: truncatedText,
                maxWidth: Infinity, // Don't wrap truncated labels
                ...fontSettings,
            })
        }
    )

    const truncatedAnnotations = wrappedLabels.map(
        ({ annotationWrap, annotationWrapNeedsTruncation }) => {
            if (!annotationWrap || !annotationWrapNeedsTruncation)
                return annotationWrap

            const truncatedText = shortenWithEllipsis(
                annotationWrap.text,
                targetWidth,
                annotationFontSettings
            )

            return new TextWrap({
                text: truncatedText,
                maxWidth: Infinity, // Don't wrap truncated labels
                ...annotationFontSettings,
            })
        }
    )

    return series.map((series, index) => ({
        ...series,
        label: truncatedLabels[index],
        annotationTextWrap: truncatedAnnotations[index],
    }))
}
