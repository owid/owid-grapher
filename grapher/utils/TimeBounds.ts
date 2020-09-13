import {
    parseIntOrUndefined,
    findClosestTime,
    isString,
    diffDateISOStringInDays,
    formatDay,
} from "grapher/utils/Util"
import { EPOCH_DATE, Time } from "grapher/core/GrapherConstants"

/**
 * An unbounded value (±Infinity) or a concrete point in time (year or date).
 */
export type TimeBound = number

export type TimeBounds = [TimeBound, TimeBound]

/**
 * The two special TimeBound values: unbounded left & unbounded right.
 */
export enum TimeBoundValue {
    unboundedLeft = -Infinity,
    unboundedRight = Infinity,
}

enum TimeBoundValueStr {
    unboundedLeft = "earliest",
    unboundedRight = "latest",
}

export function isUnbounded(time: TimeBound): time is TimeBoundValue {
    return isUnboundedLeft(time) || isUnboundedRight(time)
}

export function isUnboundedLeft(time: TimeBound): time is TimeBoundValue {
    return time === TimeBoundValue.unboundedLeft
}

export function isUnboundedRight(time: TimeBound): time is TimeBoundValue {
    return time === TimeBoundValue.unboundedRight
}

export function formatTimeBound(time: TimeBound): string {
    if (isUnboundedLeft(time)) {
        return TimeBoundValueStr.unboundedLeft
    }
    if (isUnboundedRight(time)) {
        return TimeBoundValueStr.unboundedRight
    }
    return `${time}`
}

export function parseTimeBound(
    str: string,
    defaultTo: TimeBoundValue
): TimeBound {
    if (str === TimeBoundValueStr.unboundedLeft)
        return TimeBoundValue.unboundedLeft

    if (str === TimeBoundValueStr.unboundedRight)
        return TimeBoundValue.unboundedRight

    const time = parseIntOrUndefined(str)
    return time !== undefined ? time : defaultTo
}

// Use this to not repeat logic
function fromJSON(
    value: TimeBound | string | undefined,
    defaultValue: TimeBound
) {
    if (isString(value)) return parseTimeBound(value, defaultValue)
    if (value === undefined) return defaultValue
    return value
}

function toJSON(bound: TimeBound | undefined): string | number | undefined {
    if (bound === undefined) {
        return undefined
    }
    if (isUnboundedLeft(bound)) {
        return TimeBoundValueStr.unboundedLeft
    }
    if (isUnboundedRight(bound)) {
        return TimeBoundValueStr.unboundedRight
    }
    return bound
}

export function minTimeFromJSON(
    minTime: TimeBound | string | undefined
): TimeBound {
    return fromJSON(minTime, TimeBoundValue.unboundedLeft)
}

export function maxTimeFromJSON(
    maxTime: TimeBound | string | undefined
): TimeBound {
    return fromJSON(maxTime, TimeBoundValue.unboundedRight)
}

export const minTimeToJSON = toJSON
export const maxTimeToJSON = toJSON

export function getTimeWithinTimeRange(
    [minTime, maxTime]: [Time, Time],
    bound: TimeBound
): Time {
    if (isUnboundedLeft(bound)) return minTime
    if (isUnboundedRight(bound)) return maxTime
    return Math.min(maxTime, Math.max(minTime, bound))
}

export function getClosestTime(
    times: Time[],
    bound: TimeBound,
    defaultValue: Time
): Time {
    return findClosestTime(times, bound) ?? defaultValue
}

export function getBoundFromTimeRange(
    [minTime, maxTime]: [Time, Time],
    time: Time
): TimeBound {
    if (time <= minTime) return TimeBoundValue.unboundedLeft
    if (time >= maxTime) return TimeBoundValue.unboundedRight
    return time
}

const reISODateComponent = new RegExp("\\d{4}-[01]\\d-[0-3]\\d")
const reISODate = new RegExp(`^(${reISODateComponent.source})$`)

export function formatTimeURIComponent(
    time: TimeBound,
    isDate: boolean
): string {
    if (isUnbounded(time)) return formatTimeBound(time)
    return isDate ? formatDay(time, { format: "YYYY-MM-DD" }) : `${time}`
}

export function parseTimeURIComponent(
    param: string,
    defaultValue: TimeBound
): TimeBound {
    return reISODate.test(param)
        ? diffDateISOStringInDays(param, EPOCH_DATE)
        : parseTimeBound(param, defaultValue)
}

const upgradeLegacyTimeString = (time: string) => {
    // In the past we supported unbounded time parameters like time=2015.. which would be
    // equivalent to time=2015..latest. We don't actively generate these kinds of URL any
    // more because URLs ending with dots are not interpreted correctly by many services
    // (Twitter, Facebook and others) - but we still want to recognize incoming requests
    // for these "legacy" URLs!
    if (time === "..") return "earliest..latest"
    return time.endsWith("..")
        ? time + "latest"
        : time.startsWith("..")
        ? "earliest" + time
        : time
}

export function getTimeDomainFromQueryString(time: string): [number, number] {
    time = upgradeLegacyTimeString(time)

    const reIntComponent = new RegExp("\\-?\\d+")
    const reIntRange = new RegExp(
        `^(${reIntComponent.source}|earliest)\\.\\.(${reIntComponent.source}|latest)$`
    )
    const reDateRange = new RegExp(
        `^(${reISODateComponent.source}|earliest)\\.\\.(${reISODateComponent.source}|latest)$`
    )
    if (reIntRange.test(time) || reDateRange.test(time)) {
        const [start, end] = time.split("..")
        return [
            parseTimeURIComponent(start, TimeBoundValue.unboundedLeft),
            parseTimeURIComponent(end, TimeBoundValue.unboundedRight),
        ]
    }

    const t = parseTimeURIComponent(time, TimeBoundValue.unboundedRight)
    return [t, t]
}
