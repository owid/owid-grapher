import {
    EPOCH_DATE,
    Time,
    TimeBound,
    TimeBoundValue,
} from "@ourworldindata/types"
import {
    parseIntOrUndefined,
    isString,
    diffDateISOStringInDays,
    formatDay,
    isNegativeInfinity,
    isPositiveInfinity,
} from "./Util.js"

enum TimeBoundValueStr {
    unboundedLeft = "earliest",
    unboundedRight = "latest",
}

export const timeFromTimebounds = (
    timeBound: TimeBound,
    minTime: Time,
    maxTime: Time
): number => {
    switch (timeBound) {
        case -Infinity:
            return minTime
        case Infinity:
            return maxTime
        default:
            return timeBound
    }
}

const hasAnInfinity = (timeBound: TimeBound): timeBound is TimeBoundValue =>
    isNegativeInfinity(timeBound) || isPositiveInfinity(timeBound)

const formatTimeBound = (timeBound: TimeBound): string => {
    if (isNegativeInfinity(timeBound)) return TimeBoundValueStr.unboundedLeft
    if (isPositiveInfinity(timeBound)) return TimeBoundValueStr.unboundedRight
    return `${timeBound}`
}

const parseTimeBound = (str: string): TimeBound | undefined => {
    if (str === TimeBoundValueStr.unboundedLeft)
        return TimeBoundValue.negativeInfinity

    if (str === TimeBoundValueStr.unboundedRight)
        return TimeBoundValue.positiveInfinity

    return parseIntOrUndefined(str)
}

// Use this to not repeat logic
const fromJSON = (value: TimeBound | string | undefined): number | undefined =>
    isString(value) ? parseTimeBound(value) : value

const toJSON = (bound: TimeBound | undefined): string | number | undefined => {
    if (bound === undefined) return undefined
    if (isNegativeInfinity(bound)) return TimeBoundValueStr.unboundedLeft
    if (isPositiveInfinity(bound)) return TimeBoundValueStr.unboundedRight
    return bound
}

export const minTimeBoundFromJSONOrNegativeInfinity = (
    minTime: TimeBound | string | undefined
): TimeBound => fromJSON(minTime) ?? TimeBoundValue.negativeInfinity

export const maxTimeBoundFromJSONOrPositiveInfinity = (
    maxTime: TimeBound | string | undefined
): TimeBound => fromJSON(maxTime) ?? TimeBoundValue.positiveInfinity

export const minTimeToJSON = toJSON
export const maxTimeToJSON = toJSON

const reISODateComponent = new RegExp("\\d{4}-[01]\\d-[0-3]\\d")
const reISODate = new RegExp(`^(${reISODateComponent.source})$`)

export const timeBoundToTimeBoundString = (
    timeBound: TimeBound,
    isDate: boolean
): string => {
    if (hasAnInfinity(timeBound)) return formatTimeBound(timeBound)
    return isDate
        ? formatDay(timeBound, { format: "YYYY-MM-DD" })
        : `${timeBound}`
}

const parseTimeURIComponent = (param: string): TimeBound | undefined =>
    reISODate.test(param)
        ? diffDateISOStringInDays(param, EPOCH_DATE)
        : parseTimeBound(param)

const upgradeLegacyTimeString = (time: string): string => {
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

export const getTimeDomainFromQueryString = (
    time: string
): [number, number] => {
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
            parseTimeURIComponent(start) ?? TimeBoundValue.negativeInfinity,
            parseTimeURIComponent(end) ?? TimeBoundValue.positiveInfinity,
        ]
    }

    const timebound =
        parseTimeURIComponent(time) ?? TimeBoundValue.positiveInfinity
    return [timebound, timebound]
}
