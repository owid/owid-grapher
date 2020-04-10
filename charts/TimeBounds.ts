import { parseIntOrUndefined, findClosestYear } from "./Util"

// Can only be finite number or NaN
export type Time = number

// Can be both infinite and finite
export type TimeBound = number

export type TimeBounds = [TimeBound, TimeBound]

export enum TimeBoundValue {
    unboundedLeft = -Infinity,
    unboundedRight = Infinity
}

export enum TimeBoundValueStr {
    unboundedLeft = "earliest",
    unboundedRight = "latest"
}

export function isTime(time: TimeBound | Time): time is Time {
    return !isUnbounded(time)
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

export function normalizeMinTime(minTime: TimeBound | undefined): TimeBound {
    return minTime === undefined ? TimeBoundValue.unboundedLeft : minTime
}

export function normalizeMaxTime(maxTime: TimeBound | undefined): TimeBound {
    return maxTime === undefined ? TimeBoundValue.unboundedRight : maxTime
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
    if (str === TimeBoundValueStr.unboundedLeft) {
        return TimeBoundValue.unboundedLeft
    }
    if (str === TimeBoundValueStr.unboundedRight) {
        return TimeBoundValue.unboundedRight
    }
    const time = parseIntOrUndefined(str)
    return time !== undefined ? time : defaultTo
}

export function getTimeFromTimeRange(
    [minTime, maxTime]: [Time, Time],
    bound: TimeBound
): Time {
    if (isUnboundedLeft(bound)) return minTime
    if (isUnboundedRight(bound)) return maxTime
    return Math.min(maxTime, Math.max(minTime, bound))
}

export function getTimeFromTimes(
    times: Time[],
    bound: TimeBound,
    defaultValue: Time
): Time {
    return findClosestYear(times, bound) ?? defaultValue
}

export function getBoundFromTimeRange(
    [minTime, maxTime]: [Time, Time],
    time: Time
): TimeBound {
    if (time <= minTime) return TimeBoundValue.unboundedLeft
    if (time >= maxTime) return TimeBoundValue.unboundedRight
    return time
}
