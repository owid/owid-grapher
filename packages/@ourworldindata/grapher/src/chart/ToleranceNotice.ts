import {
    CoreColumn,
    getOriginalTimeColumnSlug,
    isNotErrorValue,
    OwidTable,
} from "@ourworldindata/core-table"
import { ColumnSlug, EntityName, TimeInterval } from "@ourworldindata/types"
import { isSubYearly } from "@ourworldindata/utils"

/**
 * Explains that some of the values on screen were filled in from a nearby
 * time, e.g. "Where data is missing, the closest available value within 3
 * years is used instead."
 *
 * Only shown where tolerance was actually applied to something on screen, so
 * the condition it describes is always one that occurred. It quotes the
 * configured tolerance rather than the largest gap actually bridged, so the
 * sentence doesn't churn as the timeline moves.
 */
export function makeToleranceNotice({
    timeColumn,
    timeTolerance,
    timeSpan,
}: {
    timeColumn: CoreColumn
    /** The configured tolerance, i.e. the largest gap the chart allows for */
    timeTolerance: number
    /** The chart's full time range, from findTimeSpan */
    timeSpan?: number
}): string | undefined {
    if (!timeTolerance || timeColumn.isMissing) return undefined

    // A chart covering a single point in time has nowhere to draw a
    // substitute from, so its tolerance can never be applied however it's
    // configured, and there's nothing to caveat
    if (timeSpan === 0) return undefined

    // A tolerance that spans the whole chart isn't a window, it just means
    // "whenever there is data". Indicators configured that way use a sentinel
    // like 9999, which would otherwise read as "within 9999 years".
    const isUnbounded = timeSpan !== undefined && timeTolerance >= timeSpan
    if (isUnbounded)
        return "Where data is missing, the closest available value is used instead."

    const tolerance = formatTimeTolerance(
        timeTolerance,
        timeColumn.timeInterval
    )

    return `Where data is missing, the closest available value within ${tolerance} is used instead.`
}

/**
 * Whether any value in the given columns is filled in from a different time
 * than the one it's shown for.
 *
 * The table decides what "shown" means. Pass the transformed table to ask
 * about the year currently on screen, which is what decides whether the notice
 * is displayed; pass the table from before the timeline filter to ask about
 * any year the chart could show, which is what decides whether the footer
 * reserves space for it.
 *
 * Charts whose transform narrows the table to the selected entities get "only
 * what's on screen" for free; the map passes `entityNames` to the same effect
 * when zoomed into a continent.
 *
 * Reads the raw column store and stops at the first deviation, so it allocates
 * nothing and usually touches only a handful of rows.
 */
export function hasToleranceApplied(
    table: OwidTable,
    columnSlugs: (ColumnSlug | undefined)[],
    { entityNames }: { entityNames?: Set<EntityName> } = {}
): boolean {
    const { timeColumn } = table
    if (timeColumn.isMissing) return false

    const times = timeColumn.valuesIncludingErrorValues
    const entities = entityNames
        ? table.entityNameColumn.valuesIncludingErrorValues
        : undefined

    return columnSlugs.some((slug) => {
        if (!slug || !table.has(slug)) return false

        // Missing when the column was never interpolated, e.g. its tolerance
        // is zero, or a scatter's two columns have mismatching time types
        const originalTimeSlug = getOriginalTimeColumnSlug(table, slug)
        if (!originalTimeSlug || !table.has(originalTimeSlug)) return false

        const originalTimes =
            table.get(originalTimeSlug).valuesIncludingErrorValues
        const values = table.get(slug).valuesIncludingErrorValues

        for (let i = 0; i < times.length; i++) {
            // Compare times first: it's a plain value check, and on a column
            // with no gaps it rejects every row without touching the costlier
            // conditions below
            if (times[i] === originalTimes[i]) continue
            // A row with no value shows nothing, so it borrows nothing; its
            // original time is an error value, which is why it lands here
            if (!isNotErrorValue(values[i])) continue
            if (entities && !entityNames!.has(entities[i] as EntityName))
                continue
            return true
        }
        return false
    })
}

/**
 * The chart's full time range, which the tolerance is measured against. Taken
 * from the input table so that it doesn't shrink as the timeline moves.
 */
export function findTimeSpan(table: OwidTable): number | undefined {
    const { minTime, maxTime } = table
    if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) return undefined
    return maxTime! - minTime
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
