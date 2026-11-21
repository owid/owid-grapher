import { REGIONS, type Region } from "./types.js"

const NBSP = " "

const REGION_SET: ReadonlySet<string> = new Set(REGIONS)

/**
 * A region's name as the chart shows it: "and" shortened to "&", so the
 * long World Bank names take less room in the legend and inside the bands.
 * Other names (countries, World) pass through unchanged.
 */
export function displayEntityName(name: string): string {
    return REGION_SET.has(name) ? name.replaceAll(" and ", " & ") : name
}

export function displayRegionName(region: Region): string {
    return displayEntityName(region)
}

/**
 * Where a long legend label may wrap. Each inner array is one line: its
 * words are joined with non-breaking spaces, so the browser can only break
 * between the lines, never inside them.
 */
const PREFERRED_LINE_BREAKS: Record<string, string[][]> = {
    "Middle East, North Africa, Afghanistan and Pakistan": [
        ["Middle", "East,", "North", "Africa,"],
        ["Afghanistan", "&", "Pakistan"],
    ],
}

/** The label to render for a legend entry, with any preferred line breaks applied */
export function formatLegendLabel(label: string): string {
    const lines = PREFERRED_LINE_BREAKS[label]
    if (!lines) return displayEntityName(label)
    return lines.map((words) => words.join(NBSP)).join(" ")
}

/**
 * The label's preferred lines, for layouts that always break there: a label
 * without preferred breaks is a single line
 */
export function legendLabelLines(label: string): string[] {
    const lines = PREFERRED_LINE_BREAKS[label]
    if (!lines) return [displayEntityName(label)]
    return lines.map((words) => words.join(" "))
}
