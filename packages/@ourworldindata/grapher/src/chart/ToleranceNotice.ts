import {
    CoreColumn,
    getOriginalTimeColumnSlug,
    OwidTable,
} from "@ourworldindata/core-table"
import { ColumnSlug, Time, TimeInterval } from "@ourworldindata/types"
import { isSubYearly } from "@ourworldindata/utils"

/** The sentence explaining the chart's tolerance, if it has one worth stating */
export function makeToleranceNotice({
    timeColumn,
    timeTolerance,
    timeRange,
}: {
    timeColumn: CoreColumn
    timeTolerance: number
    timeRange: [Time, Time] | undefined
}): string | undefined {
    if (!timeTolerance || timeColumn.isMissing) return undefined

    // Without times there's nothing tolerance could have substituted
    if (!timeRange) return undefined

    // No target time for charts that plot a time range
    const targetTime =
        timeColumn.uniqTimesAsc.length === 1
            ? timeColumn.uniqTimesAsc[0]
            : undefined

    const [firstTime, lastTime] = timeRange

    // Tolerance can't be applied if the chart only has a single time
    if (firstTime === lastTime) return undefined

    // A tolerance that spans the whole chart isn't a window, it just means
    // "whenever there is data". Indicators configured that way use a sentinel
    // like 9999, which would otherwise read as "within 9999 years".
    const isUnbounded = timeTolerance >= lastTime - firstTime
    if (isUnbounded)
        return "Where data is unavailable, the closest available value is shown instead."

    // Detailed notice for a chart that plots a single year,
    // all other cases (time range plotted, sub-yearly data) use a simpler notice
    if (targetTime !== undefined && !isSubYearly(timeColumn.timeInterval)) {
        const from = Math.max(targetTime - timeTolerance, firstTime)
        const to = Math.min(targetTime + timeTolerance, lastTime)
        return `Where data for ${timeColumn.formatTime(targetTime)} is unavailable, the value from the closest year between ${timeColumn.formatTime(from)} and ${timeColumn.formatTime(to)} is shown instead.`
    } else {
        const tolerance = formatTimeTolerance(
            timeTolerance,
            timeColumn.timeInterval
        )

        return `Where data is unavailable, the closest value within ${tolerance} is shown instead.`
    }
}

/**
 * Whether any value in the given columns is filled in from a different time
 * than the one it's shown for. Typically called with a `tranformedTable`.
 */
export function hasToleranceApplied(
    table: OwidTable,
    columnSlugs: ColumnSlug[]
): boolean {
    const { timeColumn } = table
    if (timeColumn.isMissing) return false

    const times = timeColumn.valuesIncludingErrorValues

    return columnSlugs.some((slug) => {
        const originalTimeSlug = getOriginalTimeColumnSlug(table, slug)
        if (!table.has(slug) || !table.has(originalTimeSlug)) return false

        const originalTimes =
            table.get(originalTimeSlug).valuesIncludingErrorValues

        for (let i = 0; i < times.length; i++) {
            if (times[i] !== originalTimes[i]) return true
        }

        return false
    })
}

/** The largest tolerance configured on any of the given columns */
export function getMaxConfiguredTolerance(columns: CoreColumn[]): number {
    return Math.max(0, ...columns.map((column) => column.tolerance))
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
