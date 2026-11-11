const NBSP = " "

/**
 * Where a long legend label may wrap. Each inner array is one line: its
 * words are joined with non-breaking spaces, so the browser can only break
 * between the lines, never inside them.
 */
const PREFERRED_LINE_BREAKS: Record<string, string[][]> = {
    "Middle East, North Africa, Afghanistan and Pakistan": [
        ["Middle", "East,", "North", "Africa,"],
        ["Afghanistan", "and", "Pakistan"],
    ],
}

/** The label to render for a legend entry, with any preferred line breaks applied */
export function formatLegendLabel(label: string): string {
    const lines = PREFERRED_LINE_BREAKS[label]
    if (!lines) return label
    return lines.map((words) => words.join(NBSP)).join(" ")
}
