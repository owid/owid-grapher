import {
    CoreColumn,
    getOriginalTimeColumnSlug,
    OwidTable,
} from "@ourworldindata/core-table"
import {
    Time,
    TimeInterval,
    TimeRange,
    ToleranceStrategy,
} from "@ourworldindata/types"
import { isSubYearly } from "@ourworldindata/utils"

/**
 * The notice a chart should show, if it has a tolerance worth stating and any
 * value it plots is actually filled in from another time.
 */
export function makeToleranceNotice({
    inputTable,
    transformedTable,
    columns,
    timeTolerance,
    toleranceStrategy,
}: {
    inputTable: OwidTable
    transformedTable: OwidTable
    columns: CoreColumn[]
    timeTolerance?: number
    toleranceStrategy?: ToleranceStrategy
}): string | undefined {
    const configuredTolerance =
        timeTolerance ?? getMaxConfiguredTolerance(columns)
    if (!configuredTolerance) return undefined

    const appliedColumns = columnsWithToleranceApplied(
        transformedTable,
        columns
    )
    if (!appliedColumns.length) return undefined

    // Only take into account the tolerance configured on the columns
    // that actually had a value filled in from another time
    const appliedTolerance = getMaxConfiguredTolerance(appliedColumns)
    const statedTolerance =
        timeTolerance ?? (appliedTolerance || configuredTolerance)

    return formatToleranceNotice({
        timeColumn: transformedTable.timeColumn,
        timeRange: inputTable.timeRange,
        timeTolerance: statedTolerance,
        toleranceStrategy,
    })
}

export function formatToleranceNotice({
    timeColumn,
    timeTolerance,
    timeRange,
    toleranceStrategy = ToleranceStrategy.closest,
}: {
    timeColumn: CoreColumn
    timeTolerance: number
    timeRange: TimeRange | undefined
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

        // The target year has no data, so a window ending on it stops a year short
        const start = from === targetTime ? from + 1 : from
        const end = to === targetTime ? to - 1 : to

        // A one-directional window at the edge of the data reaches nothing
        if (start > end) return undefined

        const format = (time: Time): string => timeColumn.formatTime(time)
        const window =
            start === end
                ? format(start)
                : `the closest year between ${format(start)} and ${format(end)}`

        return `Where data for ${format(targetTime)} is unavailable, the value from ${window} is shown instead.`
    } else {
        // "closest", plus the direction where the tolerance only looks one way
        const closest =
            toleranceStrategy === ToleranceStrategy.backwards
                ? "closest earlier"
                : toleranceStrategy === ToleranceStrategy.forwards
                  ? "closest later"
                  : "closest"

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

/** The largest tolerance configured on any of the given columns */
export function getMaxConfiguredTolerance(columns: CoreColumn[]): number {
    return Math.max(0, ...columns.map((column) => column.tolerance))
}

/**
 * Of the given columns, those with a value that is filled in from a different
 * time than the one it's shown for. Typically called with a `transformedTable`.
 */
function columnsWithToleranceApplied(
    table: OwidTable,
    columns: CoreColumn[]
): CoreColumn[] {
    const { timeColumn } = table
    if (timeColumn.isMissing) return []

    const times = timeColumn.valuesIncludingErrorValues

    return columns.filter((column) => {
        const { slug } = column
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

/** The tolerance in words, e.g. "3 years" or "a year" */
function formatTimeTolerance(
    tolerance: number,
    timeInterval: TimeInterval
): string {
    // Sub-yearly times are stored as days, so their tolerance is in days
    const unit = isSubYearly(timeInterval) ? "day" : "year"

    return tolerance === 1 ? `a ${unit}` : `${tolerance} ${unit}s`
}
