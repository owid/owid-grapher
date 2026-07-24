import * as _ from "lodash-es"
import {
    dayjs,
    formatDay,
    Tickmark,
    convertDaysSinceEpochToDate,
    convertDateToDaysSinceEpoch,
    snapToIntervalStart,
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

// Calendar-nice step sizes in months for quarterly axes,
// so they never show sub-quarter ticks
const QUARTER_STEPS = [
    3, // 1 quarter
    6, // 2 quarters
    12, // 1 year
    24, // 2 years
    60, // 5 years
    120, // 10 years
    300, // 25 years
    600, // 50 years
    1200, // 100 years
] as const

// Calendar-nice step sizes in days
const DAY_STEPS = [
    1, // 1 day
    2, // 2 days
    7, // 1 week
    14, // 2 weeks
] as const

// Calendar-nice step sizes in days for weekly axes,
// so they never show sub-week ticks
const WEEK_STEPS = [
    7, // 1 week
    14, // 2 weeks
] as const

export type CalendarTickInterval = Exclude<
    TimeInterval,
    TimeInterval.Year | TimeInterval.Decade
>

/** A time value plus derived calendar fields for evenly spaced ticks */
interface CalendarValue {
    value: number
    monthIndex: number
    isFirstOfMonth: boolean
    isFirstWeekOfMonth: boolean
}

/** Maps a value to its index on a grid, or `undefined` when it is off-grid */
type GetGridIndex = (value: CalendarValue) => number | undefined

/** A tickmark for a day-since-epoch `value`, labeled with the given dayjs format. */
function makeDayTick(value: number, format: string): Tickmark {
    return { value, priority: 2, label: formatDay(value, { format }) }
}

/** Converts a day-since-epoch value to CalendarValue metadata. */
function toCalendarValue(value: number): CalendarValue {
    const date = convertDaysSinceEpochToDate(value)
    return {
        value,
        monthIndex: date.year() * 12 + date.month(),
        isFirstOfMonth: date.date() === 1,
        isFirstWeekOfMonth: date.date() <= 7,
    }
}

/**
 * The reference day that anchors a day grid with the given step: a Monday for
 * weekly steps (so ticks land on week starts), the epoch otherwise.
 */
function dayGridReference(step: number): number {
    return step % 7 === 0 ? snapToIntervalStart(0, TimeInterval.Week) : 0
}

/**
 * The index of a value on the day grid with the given step,
 * or `undefined` when the value is off-grid.
 */
function dayGridPosition(
    { value }: CalendarValue,
    step: number
): number | undefined {
    const index = (value - dayGridReference(step)) / step
    return Number.isInteger(index) ? index : undefined
}

/**
 * The index of a value on the January-anchored month grid with the given
 * step, or `undefined` when the value is off-grid.
 */
function monthGridPosition(
    { monthIndex }: CalendarValue,
    step: number
): number | undefined {
    const index = monthIndex / step
    return Number.isInteger(index) ? index : undefined
}

/**
 * Labels each grid value with `format`, switching to `formatWithYear` on the
 * first tick and wherever the year changes.
 */
function labelGridWithYearOnChange(
    grid: number[],
    { format, formatWithYear }: { format: string; formatWithYear: string }
): Tickmark[] {
    const years = grid.map((value) => convertDaysSinceEpochToDate(value).year())
    const isNewYear = (i: number): boolean =>
        i === 0 || years[i] !== years[i - 1]

    // When at least half the ticks carry the year anyway, an alternation of
    // wide and narrow labels (e.g. "Jan 2020 · Jul · Jan 2021") saves no
    // meaningful space and just looks inconsistent, so all ticks get the year
    const newYearCount = grid.filter((_, i) => isNewYear(i)).length
    if (newYearCount >= grid.length / 2)
        return grid.map((value) => makeDayTick(value, formatWithYear))

    return grid.map((value, i) =>
        makeDayTick(value, isNewYear(i) ? formatWithYear : format)
    )
}

/**
 * The grid of the smallest step that keeps the tick count at or below the
 * target, or `undefined` when even the coarsest step produces too many ticks.
 */
function findGridForTarget({
    steps,
    targetCount,
    span,
    gridForStep,
}: {
    steps: readonly number[]
    targetCount: number
    span: number
    gridForStep: (step: number) => number[]
}): number[] | undefined {
    for (const step of steps) {
        const grid = gridForStep(step)
        if (span / step <= targetCount || grid.length <= targetCount)
            return grid
    }
    return undefined
}

/** Calendar-aware ticks for a time axis */
export function buildTimeAxisTicks({
    interval,
    domain,
    targetCount,
    bandValues,
}: {
    interval: CalendarTickInterval
    domain: [number, number]
    targetCount: number
    bandValues?: number[]
}): Tickmark[] | undefined {
    // Discrete time axes place one tick per provided band value
    if (bandValues?.length) return buildDiscreteTimeAxisTicks({ bandValues })

    return match(interval)
        .with(TimeInterval.Quarter, () =>
            buildContinuousQuarterlyAxisTicks({ domain, targetCount })
        )
        .with(TimeInterval.Month, () =>
            buildContinuousMonthlyAxisTicks({ domain, targetCount })
        )
        .with(TimeInterval.Week, () =>
            buildContinuousWeeklyAxisTicks({ domain, targetCount })
        )
        .with(TimeInterval.Day, () =>
            buildContinuousDailyAxisTicks({ domain, targetCount })
        )
        .exhaustive()
}

/**
 * An evenly-spaced, January-anchored month grid stepped by one of the given
 * step sizes, sized to `targetCount`, with redundant year/month parts
 * dropped from the labels.
 */
function buildContinuousMonthGridTicks({
    domain,
    targetCount,
    steps,
}: {
    domain: [number, number]
    targetCount: number
    steps: readonly number[]
}): Tickmark[] | undefined {
    const minDate = convertDaysSinceEpochToDate(domain[0])
    const maxDate = convertDaysSinceEpochToDate(domain[1])

    const spanMonths = maxDate
        .startOf("month")
        .diff(minDate.startOf("month"), "month")
    if (spanMonths <= 0) return undefined

    const gridForStep = (step: number): number[] => {
        // Start from January of a "nice" anchor year. For year-based steps
        // (12+ months), round the year down to the nearest multiple of the
        // step in years, e.g. step=5y and min year=2023 -> anchor year=2020.
        let anchorYear = minDate.year()
        if (step >= 12) {
            const yearsStep = step / 12
            anchorYear = Math.floor(anchorYear / yearsStep) * yearsStep
        }

        const anchor = dayjs.utc(`${anchorYear}-01-01`)
        const monthsFromAnchor = (date: dayjs.Dayjs): number =>
            date.startOf("month").diff(anchor, "month")

        // The first and last grid indices that stay within the domain
        const firstGridIndex = Math.ceil(monthsFromAnchor(minDate) / step)
        const lastGridIndex = Math.floor(monthsFromAnchor(maxDate) / step)

        return (
            _.range(firstGridIndex, lastGridIndex + 1)
                .map((k) =>
                    convertDateToDaysSinceEpoch(anchor.add(k * step, "month"))
                )
                // The first index is rounded from the domain's start month, so
                // a mid-month domain start can produce a tick just before it -
                // drop those
                .filter((value) => value >= domain[0] && value <= domain[1])
        )
    }

    const grid =
        findGridForTarget({
            steps,
            targetCount,
            span: spanMonths,
            gridForStep,
        }) ??
        // Even the coarsest step produces too many ticks; use it anyway
        gridForStep(steps[steps.length - 1])
    if (!grid.length) return undefined

    // When every tick is a January, drop the redundant month and label only the year
    const isJanuary = (value: number): boolean =>
        convertDaysSinceEpochToDate(value).month() === 0
    if (grid.every(isJanuary))
        return grid.map((value) => makeDayTick(value, "YYYY"))

    // Otherwise label the month only, keeping the year on the first tick
    // and each January (i.e. wherever the year changes)
    return labelGridWithYearOnChange(grid, {
        format: "MMM",
        formatWithYear: "MMM YYYY",
    })
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
    return buildContinuousMonthGridTicks({
        domain,
        targetCount,
        steps: MONTH_STEPS,
    })
}

/**
 * A calendar-nice quarter grid (labeled with month names), sized to
 * `targetCount`.
 */
export function buildContinuousQuarterlyAxisTicks({
    domain,
    targetCount,
}: {
    domain: [number, number]
    targetCount: number
}): Tickmark[] | undefined {
    return buildContinuousMonthGridTicks({
        domain,
        targetCount,
        steps: QUARTER_STEPS,
    })
}

/**
 * A calendar-nice day grid stepped by one of the given step sizes, sized to
 * `targetCount`, with redundant year parts dropped from the labels. Spans
 * too long for the coarsest step continue on the monthly grid.
 */
function buildContinuousDayGridTicks({
    domain,
    targetCount,
    steps,
}: {
    domain: [number, number]
    targetCount: number
    steps: readonly number[]
}): Tickmark[] | undefined {
    const spanDays = domain[1] - domain[0]
    if (spanDays <= 0) return undefined

    const gridForStep = (step: number): number[] => {
        const reference = dayGridReference(step)
        // The first and last grid indices that stay within the domain
        const firstGridIndex = Math.ceil((domain[0] - reference) / step)
        const lastGridIndex = Math.floor((domain[1] - reference) / step)
        return _.range(firstGridIndex, lastGridIndex + 1).map(
            (k) => reference + k * step
        )
    }

    // If even the coarsest step is too dense, fall through to the monthly
    // (and yearly) grid
    let grid = findGridForTarget({
        steps,
        targetCount,
        span: spanDays,
        gridForStep,
    })
    if (grid === undefined) {
        const monthlyTicks = buildContinuousMonthlyAxisTicks({
            domain,
            targetCount,
        })
        if (monthlyTicks) return monthlyTicks

        // A span within a single calendar month has no monthly grid to
        // continue on; fallback to the coarsest step in that case
        grid = gridForStep(steps[steps.length - 1])
    }
    if (!grid.length) return undefined

    // Label the day and month, keeping the year on the first tick
    // and wherever the year changes
    return labelGridWithYearOnChange(grid, {
        format: "MMM D",
        formatWithYear: "MMM D, YYYY",
    })
}

/**
 * A calendar-nice day grid (every day, every other day, weekly or biweekly
 * on Mondays), sized to `targetCount`, with redundant year parts dropped from
 * the labels. Spans too long for day-sized steps continue on the monthly grid.
 */
export function buildContinuousDailyAxisTicks({
    domain,
    targetCount,
}: {
    domain: [number, number]
    targetCount: number
}): Tickmark[] | undefined {
    return buildContinuousDayGridTicks({
        domain,
        targetCount,
        steps: DAY_STEPS,
    })
}

/**
 * A calendar-nice week grid (weekly or biweekly on Mondays, labeled with the
 * week-start dates), sized to `targetCount`. Spans too long for week-sized
 * steps continue on the monthly grid.
 */
export function buildContinuousWeeklyAxisTicks({
    domain,
    targetCount,
}: {
    domain: [number, number]
    targetCount: number
}): Tickmark[] | undefined {
    return buildContinuousDayGridTicks({
        domain,
        targetCount,
        steps: WEEK_STEPS,
    })
}

/**
 * One tick per domain value. The ticks carry no label, so the axis falls back
 * to the column's own time format.
 */
export function buildDiscreteTimeAxisTicks({
    bandValues,
}: {
    bandValues: number[]
}): Tickmark[] {
    return _.sortBy(_.uniq(bandValues)).map((value) => ({ value, priority: 2 }))
}

/**
 * The label sets a discrete time axis can pick from, ordered from finest to
 * coarsest — each a single evenly-spaced set (every day, week, month, quarter,
 * year, …). The axis shows the finest that fits; using one spacing per set
 * ensures the gaps remain uniform.
 */
export function getDiscreteTimeTickOptions({
    interval,
    bandValues,
}: {
    interval: CalendarTickInterval
    bandValues: number[]
}): Tickmark[][] {
    return match(interval)
        .with(TimeInterval.Quarter, () =>
            getDiscreteQuarterlyTickOptions({ bandValues })
        )
        .with(TimeInterval.Month, () =>
            getDiscreteMonthlyTickOptions({ bandValues })
        )
        .with(TimeInterval.Week, () =>
            getDiscreteWeeklyTickOptions({ bandValues })
        )
        .with(TimeInterval.Day, () =>
            getDiscreteDailyTickOptions({ bandValues })
        )
        .exhaustive()
}

/**
 * One label set per grid, starting with a set that labels every value. A grid's
 * set is only offered when its values sit on consecutive grid points, so
 * every offered set is evenly spaced. The indexers are expected to be ordered
 * from finest to coarsest.
 */
function buildTickOptionsFromGrids(
    bandValues: number[],
    getGridIndexers: GetGridIndex[]
): Tickmark[][] {
    const calendarValues = _.sortBy(_.uniq(bandValues)).map(toCalendarValue)

    const makeTier = (values: CalendarValue[]): Tickmark[] =>
        values.map(({ value }) => ({ value, priority: 2 }))

    // The finest option labels every value
    const tiers: Tickmark[][] = [makeTier(calendarValues)]
    if (calendarValues.length <= 1) return tiers

    for (const getGridIndex of getGridIndexers) {
        const valuesOnGrid = calendarValues
            .map((value) => ({ value, index: getGridIndex(value) }))
            .filter(
                (entry): entry is { value: CalendarValue; index: number } =>
                    entry.index !== undefined
            )

        // Require at least two values
        if (valuesOnGrid.length < 2) continue

        // Only offer evenly-spaced sets
        const isEvenlySpaced = valuesOnGrid.every(
            ({ index }, i) => i === 0 || index - valuesOnGrid[i - 1].index === 1
        )
        if (!isEvenlySpaced) continue

        // The axis shows the first set whose labels fit, so a set with as
        // many labels as the previous one can't fit where that one didn't —
        // only offer strictly smaller sets
        if (valuesOnGrid.length === tiers[tiers.length - 1].length) continue

        tiers.push(makeTier(valuesOnGrid.map(({ value }) => value)))

        // Two labels are the smallest useful tier, and later (coarser)
        // grids cannot produce a strictly smaller tier
        if (valuesOnGrid.length === 2) break
    }

    return tiers
}

/** See getDiscreteTimeTickOptions; steps every month, quarter, year, … */
export function getDiscreteMonthlyTickOptions({
    bandValues,
}: {
    bandValues: number[]
}): Tickmark[][] {
    return buildTickOptionsFromGrids(
        bandValues,
        MONTH_STEPS.map(
            (step) => (value: CalendarValue) => monthGridPosition(value, step)
        )
    )
}

/** See getDiscreteTimeTickOptions; steps every quarter, half-year, year, … */
export function getDiscreteQuarterlyTickOptions({
    bandValues,
}: {
    bandValues: number[]
}): Tickmark[][] {
    return buildTickOptionsFromGrids(
        bandValues,
        QUARTER_STEPS.map(
            (step) => (value: CalendarValue) => monthGridPosition(value, step)
        )
    )
}

/**
 * See getDiscreteTimeTickOptions; steps weekly and biweekly (on Mondays),
 * then continues on the monthly grid restricted to each month's first week,
 * so ticks stay on actual week values.
 */
export function getDiscreteWeeklyTickOptions({
    bandValues,
}: {
    bandValues: number[]
}): Tickmark[][] {
    return buildTickOptionsFromGrids(bandValues, [
        ...WEEK_STEPS.map(
            (step) => (value: CalendarValue) => dayGridPosition(value, step)
        ),
        ...MONTH_STEPS.map(
            (step) => (value: CalendarValue) =>
                value.isFirstWeekOfMonth
                    ? monthGridPosition(value, step)
                    : undefined
        ),
    ])
}

/**
 * See getDiscreteTimeTickOptions; steps every day, every other day,
 * weekly and biweekly (on Mondays), then continues on the monthly grid
 * restricted to first-of-month values.
 */
export function getDiscreteDailyTickOptions({
    bandValues,
}: {
    bandValues: number[]
}): Tickmark[][] {
    return buildTickOptionsFromGrids(bandValues, [
        ...DAY_STEPS.map(
            (step) => (value: CalendarValue) => dayGridPosition(value, step)
        ),
        ...MONTH_STEPS.map(
            (step) => (value: CalendarValue) =>
                value.isFirstOfMonth
                    ? monthGridPosition(value, step)
                    : undefined
        ),
    ])
}
