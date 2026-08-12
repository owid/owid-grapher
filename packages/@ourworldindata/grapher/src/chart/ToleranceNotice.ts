import {
    CoreColumn,
    getOriginalTimeColumnSlug,
    OwidTable,
} from "@ourworldindata/core-table"
import {
    ColumnSlug,
    Time,
    TimeInterval,
    ToleranceStrategy,
} from "@ourworldindata/types"
import { isSubYearly } from "@ourworldindata/utils"

/** The sentence explaining the chart's tolerance, if it has one worth stating */
export function makeToleranceNotice({
    timeColumn,
    timeTolerance,
    timeRange,
    toleranceStrategy = ToleranceStrategy.closest,
}: {
    timeColumn: CoreColumn
    timeTolerance: number
    timeRange: [Time, Time] | undefined
    toleranceStrategy?: ToleranceStrategy
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

    // Detailed notice for a chart with yearly data that plots a single year,
    // all other cases (time range plotted, sub-yearly data) use a simpler notice
    if (targetTime !== undefined && !isSubYearly(timeColumn.timeInterval)) {
        // A one-directional strategy reaches to one side of the time shown only
        const from =
            toleranceStrategy === ToleranceStrategy.forwards
                ? targetTime
                : Math.max(targetTime - timeTolerance, firstTime)
        const to =
            toleranceStrategy === ToleranceStrategy.backwards
                ? targetTime
                : Math.min(targetTime + timeTolerance, lastTime)
        // A one-directional window at the edge of the data reaches nothing
        if (from === targetTime && to === targetTime) return undefined

        const window = formatToleranceWindow(timeColumn, targetTime, [from, to])

        return `Where data for ${timeColumn.formatTime(targetTime)} is unavailable, the value from ${window} is shown instead.`
    } else {
        // "closest", plus the direction where the tolerance only looks one way
        const closest =
            toleranceStrategy === ToleranceStrategy.backwards
                ? "closest earlier"
                : toleranceStrategy === ToleranceStrategy.forwards
                  ? "closest later"
                  : "closest available"

        // A tolerance that spans the whole chart isn't a window, it just means
        // "whenever there is data". Indicators configured that way use a sentinel
        // like 9999, which would otherwise read as "within 9999 days"
        const isUnbounded = timeTolerance >= lastTime - firstTime
        if (isUnbounded)
            return `Where data is unavailable, the ${closest} value is shown instead.`

        const tolerance = formatTimeTolerance(
            timeTolerance,
            timeColumn.timeInterval
        )

        return `Where data is unavailable, the ${closest} value within ${tolerance} is shown instead.`
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

/** The years a value shown for `targetTime` can come from, in words */
function formatToleranceWindow(
    timeColumn: CoreColumn,
    targetTime: Time,
    [from, to]: [Time, Time]
): string {
    const format = (time: Time): string => timeColumn.formatTime(time)

    if (from < targetTime && to > targetTime)
        return `the closest year between ${format(from)} and ${format(to)}`

    // The window is one-sided when the chart shows the first or last year of
    // its data, which is the norm: charts default to the latest year
    const isLookingAhead = to > targetTime
    const bound = isLookingAhead ? to : from

    // Name the year itself where the window leaves just the one
    if (Math.abs(bound - targetTime) === 1) return format(bound)

    return isLookingAhead
        ? `the closest year up to ${format(to)}`
        : `the closest year back to ${format(from)}`
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
