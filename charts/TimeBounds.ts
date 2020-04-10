import { parseIntOrUndefined, findClosestYear, isString } from "./Util"

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = number

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
