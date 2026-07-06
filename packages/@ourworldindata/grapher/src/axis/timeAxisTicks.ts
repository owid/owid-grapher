import * as _ from "lodash-es"
import {
    dayjs,
    formatDay,
    Tickmark,
    convertDaysSinceEpochToDate,
    convertDateToDaysSinceEpoch,
} from "@ourworldindata/utils"
import { TimeInterval } from "@ourworldindata/types"
import { match } from "ts-pattern"

// Calendar-nice step sizes in months
const MONTH_STEPS = [
    1, // 1 month
    2, // 2 months
    3, // 3 months
    6, // 6 months
    12, // 1 year
    24, // 2 years
    60, // 5 years
    120, // 10 years
    300, // 25 years
    600, // 50 years
    1200, // 100 years
] as const

/** A tickmark for a day-since-epoch `value`, labeled with the given dayjs format. */
function makeDayTick(value: number, format: string): Tickmark {
    return { value, priority: 2, label: formatDay(value, { format }) }
}

/**
 * Calendar-aware ticks for a time axis, or `undefined` if the interval has no
 * special handling (the caller then falls back to the generic d3 ticks).
 */
export function buildTimeAxisTicks({
    interval,
    domain,
    targetCount,
    bandValues,
}: {
    interval: TimeInterval
    domain: [number, number]
    targetCount: number
    bandValues?: number[]
}): Tickmark[] | undefined {
    return match(interval)
        .with(TimeInterval.Month, () =>
            bandValues?.length
                ? buildDiscreteMonthlyAxisTicks({ bandValues })
                : buildContinuousMonthlyAxisTicks({ domain, targetCount })
        )
        .otherwise(() => undefined)
}

/**
 * An evenly-spaced, January-anchored month grid, sized to `targetCount`,
 * with redundant year/month parts dropped from the labels.
 */
export function buildContinuousMonthlyAxisTicks({
    domain,
    targetCount,
}: {
    domain: [number, number]
    targetCount: number
}): Tickmark[] | undefined {
    const minDate = convertDaysSinceEpochToDate(domain[0])
    const maxDate = convertDaysSinceEpochToDate(domain[1])

    const spanMonths = maxDate
        .startOf("month")
        .diff(minDate.startOf("month"), "month")
    if (spanMonths <= 0) return undefined

    // Pick the smallest step that keeps the tick count at or below the target.
    const step =
        MONTH_STEPS.find((s) => spanMonths / s <= targetCount) ??
        MONTH_STEPS[MONTH_STEPS.length - 1]

    // Start from January of a "nice" anchor year. For year-based steps
    // (12+ months), round the year down to the nearest multiple of the step in
    // years, e.g. step=5y and min year=2023 -> anchor year=2020.
    let anchorYear = minDate.year()
    if (step >= 12) {
        const yearsStep = step / 12
        anchorYear = Math.floor(anchorYear / yearsStep) * yearsStep
    }

    const anchor = dayjs.utc(`${anchorYear}-01-01`)
    const monthsFromAnchor = (date: dayjs.Dayjs): number =>
        date.startOf("month").diff(anchor, "month")

    // The first and last indices that stay within the domain: round the
    // start up and the end down so both ticks land inside the domain.
    const firstStep = Math.ceil(monthsFromAnchor(minDate) / step)
    const lastStep = Math.floor(monthsFromAnchor(maxDate) / step)

    const grid = _.range(firstStep, lastStep + 1).map((k) =>
        convertDateToDaysSinceEpoch(anchor.add(k * step, "month"))
    )

    // When every tick is a January, drop the redundant month and label only the year.
    const isJanuary = (value: number): boolean =>
        convertDaysSinceEpochToDate(value).month() === 0
    if (grid.every(isJanuary))
        return grid.map((value) => makeDayTick(value, "YYYY"))

    // Otherwise label the month only, keeping the year on the first tick
    // and each January (i.e. wherever the year changes)
    const years = grid.map((value) => convertDaysSinceEpochToDate(value).year())
    return grid.map((value, i) => {
        const isNewYear = i === 0 || years[i] !== years[i - 1]
        return makeDayTick(value, isNewYear ? "MMM YYYY" : "MMM")
    })
}

/** One tick per domain value, each labeled with its full month and year */
export function buildDiscreteMonthlyAxisTicks({
    bandValues,
}: {
    bandValues: number[]
}): Tickmark[] {
    return _.sortBy(_.uniq(bandValues)).map((value) =>
        makeDayTick(value, "MMM YYYY")
    )
}

/**
 * The label sets a discrete monthly axis can pick from, ordered from finest to
 * coarsest — each a single evenly-spaced set (every month, quarter, year, 2
 * years, …). The axis shows the finest that fits; using one spacing per set
 * ensures the gaps remain uniform.
 */
export function getDiscreteMonthlyTickOptions({
    bandValues,
}: {
    bandValues: number[]
}): Tickmark[][] {
    const sortedValues = _.sortBy(_.uniq(bandValues))

    const monthIndex = (value: number): number => {
        const date = convertDaysSinceEpochToDate(value)
        return date.year() * 12 + date.month()
    }

    const tiers: Tickmark[][] = []
    for (const step of MONTH_STEPS) {
        const valuesOnGrid = sortedValues.filter(
            (value) => monthIndex(value) % step === 0
        )
        if (!valuesOnGrid.length) continue

        tiers.push(valuesOnGrid.map((value) => makeDayTick(value, "MMM YYYY")))

        if (valuesOnGrid.length === 1) break // nothing coarser can add
    }

    return tiers
}
