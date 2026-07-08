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

// A fixed Monday (in days since epoch) that anchors weekly grids
const MONDAY_REFERENCE = snapToIntervalStart(0, TimeInterval.Week)

// Time intervals with calendar-aware axis ticks; all other intervals
// fall back to the generic d3 ticks
const CALENDAR_TICK_INTERVALS = [
    TimeInterval.Quarter,
    TimeInterval.Month,
    TimeInterval.Week,
    TimeInterval.Day,
] as const

export type CalendarTickInterval = (typeof CALENDAR_TICK_INTERVALS)[number]

export function isCalendarTickInterval(
    interval: TimeInterval
): interval is CalendarTickInterval {
    return (CALENDAR_TICK_INTERVALS as readonly TimeInterval[]).includes(
        interval
    )
}

/** A tickmark for a day-since-epoch `value`, labeled with the given dayjs format. */
function makeDayTick(value: number, format: string): Tickmark {
    return { value, priority: 2, label: formatDay(value, { format }) }
}

/** A band value with its calendar coordinates */
interface CalendarValue {
    value: number
    /** The calendar month, as a linear count of months */
    monthIndex: number
    isFirstOfMonth: boolean
    /** Whether the value falls within the first seven days of its month */
    isFirstWeekOfMonth: boolean
}

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
 * weekly steps (so ticks land on week starts), the epoch otherwise (so grids
 * are stable when panning).
 */
function dayGridReference(step: number): number {
    return step % 7 === 0 ? MONDAY_REFERENCE : 0
}

/**
 * The position of a value on the day grid with the given step;
 * an integer only for values that lie on the grid.
 */
function dayGridPosition({ value }: CalendarValue, step: number): number {
    return (value - dayGridReference(step)) / step
}

/**
 * The position of a value on the January-anchored month grid with the given
 * step; an integer only for values that lie on the grid.
 */
function monthGridPosition(
    { monthIndex }: CalendarValue,
    step: number
): number {
    return monthIndex / step
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
    return grid.map((value, i) => {
        const isNewYear = i === 0 || years[i] !== years[i - 1]
        return makeDayTick(value, isNewYear ? formatWithYear : format)
    })
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
    if (!isCalendarTickInterval(interval)) return undefined

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

    // Pick the smallest step that keeps the tick count at or below the target.
    const step =
        steps.find((s) => spanMonths / s <= targetCount) ??
        steps[steps.length - 1]

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

    const grid = _.range(firstStep, lastStep + 1)
        .map((k) => convertDateToDaysSinceEpoch(anchor.add(k * step, "month")))
        // The first index is rounded from the domain's start month, so a
        // mid-month domain start can produce a tick just before it - drop those
        .filter((value) => value >= domain[0] && value <= domain[1])
    if (!grid.length) return undefined

    // When every tick is a January, drop the redundant month and label only the year.
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
 * A calendar-nice quarter grid (quarter starts: Jan/Apr/Jul/Oct 1, labeled
 * with month names), sized to `targetCount`. Uses the month grid restricted
 * to quarter-sized steps, so quarterly axes never show sub-quarter ticks.
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

    // The first and last grid indices that stay within the domain: round the
    // start up and the end down so both ticks land inside the domain.
    const gridIndexRange = (step: number): [number, number] => {
        const reference = dayGridReference(step)
        return [
            Math.ceil((domain[0] - reference) / step),
            Math.floor((domain[1] - reference) / step),
        ]
    }
    const inDomainTickCount = (step: number): number => {
        const [first, last] = gridIndexRange(step)
        return last - first + 1
    }

    // Pick the smallest step that keeps the tick count at or below the
    // target; if even the coarsest step produces too many ticks, fall
    // through to the monthly (and yearly) grid. The span/step estimate can
    // count one tick more than actually lands in the domain, so also accept
    // a step by its in-domain count — otherwise a 29-day domain with a
    // target of two would skip the fitting biweekly grid and fall through
    // to a single monthly tick.
    let step = steps.find(
        (s) =>
            spanDays / s <= targetCount || inDomainTickCount(s) <= targetCount
    )
    if (step === undefined) {
        const monthlyTicks = buildContinuousMonthlyAxisTicks({
            domain,
            targetCount,
        })
        if (monthlyTicks) return monthlyTicks
        // A span within a single calendar month has no monthly grid to
        // continue on; keep the coarsest step rather than dropping calendar
        // ticks entirely, which would hand the axis to generic d3 ticks that
        // can sit between grid points (e.g. sub-week ticks on a weekly axis)
        step = steps[steps.length - 1]
    }

    const reference = dayGridReference(step)
    const [firstStep, lastStep] = gridIndexRange(step)
    const grid = _.range(firstStep, lastStep + 1).map(
        (k) => reference + k * step
    )
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
 * One tick per domain value. The ticks carry no label: each value is labeled
 * independently, so the axis falls back to the column's own time format,
 * which is never abbreviated (e.g. "Jan 2023" for months, "Jan 5, 2023"
 * for days).
 */
export function buildDiscreteTimeAxisTicks({
    bandValues,
}: {
    bandValues: number[]
}): Tickmark[] {
    return _.sortBy(_.uniq(bandValues)).map((value) => ({
        value,
        priority: 2,
    }))
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
 * Maps a value to its position on a grid; an integer for values on the grid,
 * a non-integer (or NaN) otherwise.
 */
type GridPosition = (value: CalendarValue) => number

/**
 * One label set per grid, starting with a set that labels every value. A grid's
 * set is only offered when its values sit on consecutive grid points, so
 * every offered set is evenly spaced. Skips sets that don't thin the previous
 * one. Single-value sets aren't offered: when no multi-label set fits, the
 * axis falls back to greedy labeling, which labels as many bands as fit
 * instead of a lone calendar-anchored one (often the first or last band).
 * The grids are expected to be ordered from finest to coarsest.
 */
function buildTickOptionsFromGrids(
    bandValues: number[],
    grids: GridPosition[]
): Tickmark[][] {
    const calendarValues = _.sortBy(_.uniq(bandValues)).map(toCalendarValue)
    const makeTier = (values: CalendarValue[]): Tickmark[] =>
        values.map(({ value }) => ({ value, priority: 2 }))

    // The finest option labels every value, evenly spaced or not
    const tiers: Tickmark[][] = [makeTier(calendarValues)]
    if (calendarValues.length <= 1) return tiers

    for (const gridPosition of grids) {
        const valuesOnGrid = calendarValues
            .map((value) => ({ value, position: gridPosition(value) }))
            .filter(({ position }) => Number.isInteger(position))
        if (valuesOnGrid.length < 2) continue

        // Only offer evenly-spaced sets: the values must sit on consecutive
        // grid points, otherwise the labels would have ragged gaps
        const isEvenlySpaced = valuesOnGrid.every(
            ({ position }, i) =>
                i === 0 || position - valuesOnGrid[i - 1].position === 1
        )
        if (!isEvenlySpaced) continue

        // The axis shows the first set whose labels fit, so a set with as
        // many labels as the previous one can't fit where that one didn't —
        // only offer strictly smaller sets
        if (valuesOnGrid.length === tiers[tiers.length - 1].length) continue

        tiers.push(makeTier(valuesOnGrid.map(({ value }) => value)))

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
                value.isFirstWeekOfMonth ? monthGridPosition(value, step) : NaN
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
                value.isFirstOfMonth ? monthGridPosition(value, step) : NaN
        ),
    ])
}
