import { TextWrap } from "@ourworldindata/components"

interface FontSettings {
    fontSize: number
    fontWeight: number
    lineHeight: number
}

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
 */
export function wrapLabelForHeight({
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
}): TextWrap {
    const cleanedLabel = label.replace(/\n/g, " ").trim()
    const originalFontSize = fontSettings.fontSize

    // Helper to create TextWrap with given width and font size
    const makeTextWrap = (maxWidth: number, fontSize: number): TextWrap =>
        new TextWrap({
            text: cleanedLabel,
            maxWidth,
            ...fontSettings,
            fontSize,
        })

    // Calculate max lines that can fit in the bar height
    const lineHeight = originalFontSize * fontSettings.lineHeight
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight))

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
    if (labelWrap.lines.length <= maxLines) return labelWrap

    // If not, find the largest font size that fits at maxWidth
    const optimalFontSize = findMaxFontSizeForHeight({
        label: cleanedLabel,
        maxWidth,
        availableHeight,
        maxFontSize: originalFontSize,
        fontSettings,
    })

    return makeTextWrap(maxWidth, optimalFontSize)
}

/**
 * Binary search to find the minimum width that produces at most maxLines.
 */
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

/**
 * Decrease font size until the label fits within availableHeight at maxWidth.
 */
function findMaxFontSizeForHeight({
    label,
    maxWidth,
    availableHeight,
    maxFontSize,
    fontSettings,
}: {
    label: string
    maxWidth: number
    availableHeight: number
    maxFontSize: number
    fontSettings: FontSettings
}): number {
    const minFontSize = 5
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
