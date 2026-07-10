import * as _ from "lodash-es"
import { match } from "ts-pattern"
import { CoreColumn } from "@ourworldindata/core-table"
import { EntityName, Time, TimeInterval } from "@ourworldindata/types"
import { articulateEntity, formatInlineList } from "@ourworldindata/utils"

export function makeMapToleranceNotice({
    rowsWithTolerance,
    targetTime,
    column,
    tolerance,
}: {
    rowsWithTolerance: { entityName: EntityName; originalTime: Time }[]
    targetTime: Time
    column: CoreColumn
    tolerance: number
}): string {
    const formattedTargetTime = column.formatTime(targetTime)

    if (rowsWithTolerance.length === 1) {
        const [row] = rowsWithTolerance
        return makeSingleCountryMapToleranceNotice({
            countryName: row.entityName,
            formattedTargetTime,
            formattedOriginalTime: column.formatTime(row.originalTime),
        })
    }

    return makeMultiCountryMapToleranceNotice({
        countryNames: rowsWithTolerance.map((row) => row.entityName),
        formattedTargetTime,
        formattedTimeTolerance: formatTimeTolerance(
            tolerance,
            column.originalTimeColumn.timeInterval
        ),
    })
}

/** The tolerance in words, e.g. "3 years" or "a year" */
function formatTimeTolerance(
    tolerance: number,
    timeInterval: TimeInterval
): string | undefined {
    if (tolerance <= 0) return undefined

    const unit = match(timeInterval)
        .with(TimeInterval.Year, () => "year")
        .with(TimeInterval.Day, () => "day")
        .otherwise(() => undefined)
    if (!unit) return undefined

    return tolerance === 1 ? `a ${unit}` : `${tolerance} ${unit}s`
}

function makeSingleCountryMapToleranceNotice({
    countryName,
    formattedTargetTime,
    formattedOriginalTime,
}: {
    countryName: string
    formattedTargetTime: string
    formattedOriginalTime: string
}): string {
    // The country starts the sentence, so an article needs capitalizing
    const country = _.upperFirst(articulateEntity(countryName))
    return `${country} lacks data for ${formattedTargetTime} and shows the closest available value, from ${formattedOriginalTime}.`
}

function makeMultiCountryMapToleranceNotice({
    countryNames,
    formattedTargetTime,
    formattedTimeTolerance,
}: {
    countryNames: string[]
    formattedTargetTime: string
    formattedTimeTolerance: string
}): string {
    // Name countries if there are few of them
    const subject =
        countryNames.length <= 3
            ? formatInlineList(
                  _.sortBy(countryNames).map(articulateEntity),
                  "and"
              )
            : `${countryNames.length} countries`

    // The subject starts the sentence, so an article needs capitalizing
    return `${_.upperFirst(subject)} lack data for ${formattedTargetTime} and show the closest available value within ${formattedTimeTolerance}.`
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

/**
 * A time as it reads inside a sentence, e.g. "the week of Jan 12, 2020" rather
 * than the standalone "Week of Jan 12, 2020"
 */
function formatTimeForProse(time: Time, timeColumn: CoreColumn): string {
    return match(timeColumn.timeInterval)
        .with(TimeInterval.Decade, () => `the ${timeColumn.formatTime(time)}`)
        .with(
            TimeInterval.Week,
            () => `the week of ${timeColumn.formatTimeShort(time)}`
        )
        .otherwise(() => timeColumn.formatTime(time))
}
