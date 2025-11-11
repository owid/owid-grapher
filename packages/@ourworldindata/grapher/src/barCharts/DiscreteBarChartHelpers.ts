// Pattern IDs should be unique per document (!), not just per grapher instance.
// Including the color in the id guarantees that the pattern uses the correct color,

import { TextWrap } from "@ourworldindata/components"

// even if it gets resolved to a striped pattern of a different grapher instance.
export function makeProjectedDataPatternId(color: string): string {
    return `DiscreteBarChart_stripes_${color}`
}

/**
 * Creates a TextWrap for discrete bar chart labels with automatic width adjustment.
 * The function tries to fit the label within the bar height by iteratively expanding
 * the label width up to a maximum threshold.
 */
export function fitLabelToBarHeight({
    label,
    barHeight,
    initialWidth,
    maxWidth,
    labelStyle,
}: {
    label: string
    barHeight: number
    initialWidth: number
    maxWidth: number
    labelStyle: { fontSize: number; fontWeight: number }
}): TextWrap {
    // Make sure we're dealing with a single-line text fragment
    const cleanedLabel = label.replace(/\n/g, " ").trim()

    const makeTextWrap = (maxWidth: number): TextWrap =>
        new TextWrap({ text: cleanedLabel, maxWidth, ...labelStyle })

    let labelWrap = makeTextWrap(initialWidth)

    // Prevent labels from being taller than the bar
    let step = 0
    while (
        labelWrap.height > barHeight &&
        labelWrap.lines.length > 1 &&
        step < 10 // safety net
    ) {
        const currMaxWidth = labelWrap.maxWidth + 20

        // Labels shouldn't exceed this width
        if (currMaxWidth > maxWidth) break

        labelWrap = makeTextWrap(currMaxWidth)
        step += 1
    }

    return labelWrap
}
