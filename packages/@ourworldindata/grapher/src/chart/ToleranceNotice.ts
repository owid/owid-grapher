import { CoreColumn } from "@ourworldindata/core-table"
import { TimeInterval } from "@ourworldindata/types"
import { isSubYearly } from "@ourworldindata/utils"

/**
 * Explains that a value shown for a time it has no data for is filled in from
 * the closest time that does, e.g. "Where a country or region lacks data for
 * the year shown, the closest available value within 3 years is shown instead."
 *
 * Phrased as a standing rule rather than a claim about what's on screen right
 * now ("some countries lack data for 2002..."), because the chart's note is
 * laid out above the timeline: a notice that came and went as the timeline
 * moved would resize the chart area and shift the timeline out from under the
 * handle being dragged. As a rule it holds at every point on the timeline, so
 * it never appears, disappears or rewraps. For the same reason it quotes the
 * configured tolerance rather than the largest gap actually bridged.
 */
export function makeToleranceNotice({
    timeColumn,
    entityType,
    timeTolerance,
    hasMultipleTargetTimes,
}: {
    timeColumn: CoreColumn
    entityType: string
    /** The configured tolerance, i.e. the largest gap the chart allows for */
    timeTolerance: number
    /** Whether the chart labels two time points, as a slope chart does */
    hasMultipleTargetTimes?: boolean
}): string | undefined {
    if (!timeTolerance || timeColumn.isMissing) return undefined

    const { timeInterval } = timeColumn
    const timesShown = hasMultipleTargetTimes
        ? `the ${timeInterval}s shown`
        : `the ${timeInterval} shown`

    const formattedTimeTolerance = formatTimeTolerance(
        timeTolerance,
        timeInterval
    )

    return `Where a ${entityType} lacks data for ${timesShown}, the closest available value within ${formattedTimeTolerance} is shown instead.`
}

/**
 * The largest tolerance configured on any of the given columns. Charts that
 * match values across two columns apply the wider of the two, so the maximum
 * is the gap the chart as a whole allows for.
 */
export function findConfiguredTolerance(
    columns: (CoreColumn | undefined)[]
): number {
    return Math.max(0, ...columns.map((column) => column?.tolerance ?? 0))
}

/** The tolerance in words, e.g. "3 years" or "a year" */
function formatTimeTolerance(
    tolerance: number,
    timeInterval: TimeInterval
): string {
    // Sub-yearly times are stored as days, so their tolerance is in days
    const unit = isSubYearly(timeInterval) ? "day" : "year"

    return tolerance === 1 ? `a ${unit}` : `${tolerance} ${unit}s`
}
