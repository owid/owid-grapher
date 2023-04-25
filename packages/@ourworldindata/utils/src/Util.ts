import {
    capitalize,
    chunk,
    clone,
    cloneDeep,
    compact,
    countBy,
    debounce,
    difference,
    drop,
    escapeRegExp,
    extend,
    findLastIndex,
    flatten,
    get,
    groupBy,
    identity,
    invert,
    isArray,
    isBoolean,
    isEmpty,
    isEqual,
    isNil,
    isNull,
    isNumber,
    isObject,
    isPlainObject,
    isString,
    isUndefined,
    keyBy,
    mapValues,
    max,
    maxBy,
    memoize,
    min,
    minBy,
    noop,
    omit,
    once,
    orderBy,
    partition,
    pick,
    range,
    reverse,
    round,
    sample,
    sampleSize,
    set,
    sortBy,
    sortedUniqBy,
    startCase,
    sum,
    sumBy,
    tail,
    takeWhile,
    throttle,
    toString,
    union,
    uniq,
    uniqBy,
    uniqWith,
    unset,
    upperFirst,
    without,
    zip,
} from "lodash"

export {
    capitalize,
    chunk,
    clone,
    cloneDeep,
    compact,
    countBy,
    debounce,
    difference,
    drop,
    escapeRegExp,
    extend,
    findLastIndex,
    flatten,
    get,
    groupBy,
    identity,
    invert,
    isArray,
    isBoolean,
    isEmpty,
    isEqual,
    isNil,
    isNull,
    isNumber,
    isString,
    isUndefined,
    keyBy,
    mapValues,
    max,
    maxBy,
    memoize,
    min,
    minBy,
    noop,
    omit,
    once,
    orderBy,
    partition,
    pick,
    range,
    reverse,
    round,
    sample,
    sampleSize,
    set,
    sortBy,
    sortedUniqBy,
    startCase,
    sum,
    sumBy,
    tail,
    takeWhile,
    throttle,
    toString,
    union,
    uniq,
    uniqBy,
    uniqWith,
    unset,
    upperFirst,
    without,
    zip,
}
import { extent, pairs } from "d3-array"
export { pairs }
import dayjs from "./dayjs.js"
import { formatLocale, FormatLocaleObject } from "d3-format"
import striptags from "striptags"
import parseUrl from "url-parse"
import linkifyHtml from "linkifyjs/html.js"
import {
    SortOrder,
    Integer,
    Time,
    EPOCH_DATE,
    ScaleType,
    VerticalAlign,
    HorizontalAlign,
    IDEAL_PLOT_ASPECT_RATIO,
    GridParameters,
    OwidGdocInterface,
    OwidGdocJSON,
    TimeBound,
    TimeBoundValue,
    OwidEnrichedGdocBlock,
    Span,
    OwidGdocType,
    EnrichedRecircLink,
    EnrichedTopicPageIntroRelatedTopic,
    EnrichedTopicPageIntroDownloadButton,
    EnrichedScrollerItem,
} from "./owidTypes.js"
import { PointVector } from "./PointVector.js"
import React from "react"
import { match, P } from "ts-pattern"

export type NoUndefinedValues<T> = {
    [P in keyof T]: Required<NonNullable<T[P]>>
}

type OptionalKeysOf<T> = Exclude<
    {
        [K in keyof T]: T extends Record<K, T[K]> ? never : K
    }[keyof T],
    undefined
>

type AllowUndefinedValues<T> = {
    [K in keyof T]: T[K] | undefined
}

/**
 * This generic makes every (top-level) optional property in an interface required,
 * but with `undefined` as an allowed value.
 *
 * For example:
 *     AllKeysRequired<{
 *         a: number
 *         b?: number
 *     }>
 * becomes:
 *     {
 *         a: number
 *         b: number | undefined
 *     }
 */
// This was tricky to construct.
// It seems like the initial, elegant approach is:
//
// export type AllKeysRequired<T> = {
//     [K in keyof T]-?: T extends Record<K, T[K]> ? T[K] : T[K] | undefined
// }
//
// But TypeScript will omit `undefined` from the value type whenever you
// make the key required with `-?`. So we have this ugly workaround.
//
// -@danielgavrilov, 2022-02-15
export type AllKeysRequired<T> = AllowUndefinedValues<
    Required<Pick<T, OptionalKeysOf<T>>>
> &
    Exclude<T, OptionalKeysOf<T>>

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// d3 v6 changed the default minus sign used in d3-format to "−" (Unicode minus sign), which looks
// nicer but can cause issues when copy-pasting values into a spreadsheet or script.
// For that reason we change that back to a plain old hyphen.
// See https://observablehq.com/@d3/d3v6-migration-guide#minus
export const createFormatter = (
    currency: string = "$"
): FormatLocaleObject["format"] =>
    formatLocale({
        decimal: ".",
        thousands: ",",
        grouping: [3],
        minus: "-",
        currency: [currency, ""],
    }).format

const getRootSVG = (
    element: Element | SVGGraphicsElement | SVGSVGElement
): SVGSVGElement | undefined => {
    if ("createSVGPoint" in element) return element
    if ("ownerSVGElement" in element)
        return element.ownerSVGElement || undefined
    return undefined
}

export const getRelativeMouse = (
    node: Element | SVGGraphicsElement | SVGSVGElement,
    event: React.TouchEvent | TouchEvent | { clientX: number; clientY: number }
): PointVector => {
    const eventOwner = checkIsTouchEvent(event) ? event.targetTouches[0] : event

    const { clientX, clientY } = eventOwner

    const svg = getRootSVG(node)
    if (svg && "getScreenCTM" in node) {
        const svgPoint = svg.createSVGPoint()
        svgPoint.x = clientX
        svgPoint.y = clientY
        const point = svgPoint.matrixTransform(node.getScreenCTM()?.inverse())
        return new PointVector(point.x, point.y)
    }

    const rect = node.getBoundingClientRect()
    return new PointVector(
        clientX - rect.left - node.clientLeft,
        clientY - rect.top - node.clientTop
    )
}

// Purely for local development time
const isStorybook = (): boolean =>
    window.location.host.startsWith("localhost:6006") &&
    document.title === "Storybook"

// Just a quick and dirty way to expose window.chart/explorer/etc for debugging. Last caller wins.
export const exposeInstanceOnWindow = (
    component: unknown,
    name = "chart",
    alsoOnTopWindow?: boolean
): void => {
    if (typeof window === "undefined") return
    const win = window as any
    win[name] = component
    alsoOnTopWindow =
        alsoOnTopWindow === undefined ? isStorybook() : alsoOnTopWindow
    if (alsoOnTopWindow && win !== win.top) win.top[name] = component
}

// Make an arbitrary string workable as a css class name
export const makeSafeForCSS = (name: string): string =>
    name.replace(/[^a-z0-9]/g, (str) => {
        const char = str.charCodeAt(0)
        if (char === 32) return "-"
        if (char === 95) return "_"
        if (char >= 65 && char <= 90) return str
        return "__" + ("000" + char.toString(16)).slice(-4)
    })

export function formatDay(
    dayAsYear: number,
    options?: { format?: string }
): string {
    const format = options?.format ?? "MMM D, YYYY"
    // Use dayjs' UTC mode
    // This will force dayjs to format in UTC time instead of local time,
    // making dates consistent no matter what timezone the user is in.
    return dayjs.utc(EPOCH_DATE).add(dayAsYear, "days").format(format)
}

export const formatYear = (year: number): string => {
    if (isNaN(year)) {
        console.warn(`Invalid year '${year}'`)
        return ""
    }

    return year < 0
        ? `${createFormatter()(",.0f")(Math.abs(year))} BCE`
        : year.toString()
}

/**
 *  Computes the base-10 magnitude of a number, which can be useful for rounding by sigfigs etc.
 * Formally, numberMagnitude computes `m` such that `10^(m-1) <= abs(num) < 10^m`.
 * Equivalently, `num / 10^(numberMagnitude(num))` is always in the range ±[0.1, 1[.
 *
 * - numberMagnitude(0.5) = 0
 * - numberMagnitude(1) = 1
 * - numberMagnitude(-2) = 1
 * - numberMagnitude(100) = 3
 */
export const numberMagnitude = (num: number): number => {
    if (num === 0) return 0
    const magnitude = Math.floor(Math.log10(Math.abs(num))) + 1
    return Number.isFinite(magnitude) ? magnitude : 0
}

export const roundSigFig = (num: number, sigfigs: number = 1): number => {
    if (num === 0) return 0
    const magnitude = numberMagnitude(num)
    return round(num, -magnitude + sigfigs)
}

export const first = <T>(arr: readonly T[]): T | undefined => arr[0]

export const last = <T>(arr: readonly T[]): T | undefined => arr[arr.length - 1]

export const excludeUndefined = <T>(arr: (T | undefined)[]): T[] =>
    arr.filter((x) => x !== undefined) as T[]

export const excludeNull = <T>(arr: (T | null)[]): T[] =>
    arr.filter((x) => x !== null) as T[]

export const excludeNullish = <T>(arr: (T | null | undefined)[]): T[] =>
    arr.filter((x) => x !== null && x !== undefined) as T[]

export const firstOfNonEmptyArray = <T>(arr: T[]): T => {
    if (arr.length < 1) throw new Error("array is empty")
    return first(arr) as T
}

export const lastOfNonEmptyArray = <T>(arr: T[]): T => {
    if (arr.length < 1) throw new Error("array is empty")
    return last(arr) as T
}

export const mapToObjectLiteral = <K>(
    map: Map<string, K>
): Record<string, K> => {
    const init: Record<string, K> = {}
    return Array.from(map).reduce((objLit, [key, value]) => {
        objLit[key] = value
        return objLit
    }, init)
}

export function next<T>(set: T[], current: T): T {
    let nextIndex = set.indexOf(current) + 1
    nextIndex = nextIndex === -1 ? 0 : nextIndex
    return set[nextIndex === set.length ? 0 : nextIndex]
}

export const previous = <T>(set: T[], current: T): T => {
    const nextIndex = set.indexOf(current) - 1
    return set[nextIndex < 0 ? set.length - 1 : nextIndex]
}

// Calculate the extents of a set of numbers, with safeguards for log scales
export const domainExtent = (
    numValues: number[],
    scaleType: ScaleType,
    maxValueMultiplierForPadding = 1
): [number, number] => {
    const filterValues =
        scaleType === ScaleType.log ? numValues.filter((v) => v > 0) : numValues
    const [minValue, maxValue] = extent(filterValues)

    if (
        minValue !== undefined &&
        maxValue !== undefined &&
        isFinite(minValue) &&
        isFinite(maxValue)
    ) {
        if (minValue !== maxValue) {
            return [minValue, maxValue * maxValueMultiplierForPadding]
        } else {
            // Only one value, make up a reasonable default
            return scaleType === ScaleType.log
                ? [minValue / 10, minValue * 10]
                : [minValue - 1, maxValue + 1]
        }
    } else {
        return scaleType === ScaleType.log ? [1, 100] : [-1, 1]
    }
}

// Compound annual growth rate
// cagr = ((new_value - old_value) ** (1 / Δt)) - 1
// see https://en.wikipedia.org/wiki/Compound_annual_growth_rate
export const cagr = (
    startValue: number,
    endValue: number,
    yearsElapsed: number
): number => {
    const ratio = endValue / startValue
    return (
        Math.sign(ratio) *
        (Math.pow(Math.abs(ratio), 1 / yearsElapsed) - 1) *
        100
    )
}

export const makeAnnotationsSlug = (columnSlug: string): string =>
    `${columnSlug}-annotations`

// Take an arbitrary string and turn it into a nice url slug
export const slugify = (str: string): string =>
    slugifySameCase(str.toLowerCase())

export const slugifySameCase = (str: string): string =>
    str
        .trim()
        .replace(/\s*\*.+\*/, "")
        .replace(/[^\w- ]+/g, "")
        .replace(/ +/g, "-")

// Unique number for this execution context
// Useful for coordinating between embeds to avoid conflicts in their ids
let _guid = 0
export const guid = (): number => ++_guid
export const TESTING_ONLY_reset_guid = (): number => (_guid = 0)

// Take an array of points and make it into an SVG path specification string
export const pointsToPath = (points: Array<[number, number]>): string => {
    let path = ""
    for (let i = 0; i < points.length; i++) {
        if (i === 0) path += `M${points[i][0]} ${points[i][1]}`
        else path += `L${points[i][0]} ${points[i][1]}`
    }
    return path
}

// Based on https://stackoverflow.com/a/30245398/1983739
// In case of tie returns higher value
// todo: add unit tests
export const sortedFindClosestIndex = (
    array: number[],
    value: number,
    startIndex: number = 0,
    // non-inclusive end
    endIndex: number = array.length
): number => {
    if (startIndex >= endIndex) return -1

    if (value < array[startIndex]) return startIndex

    if (value > array[endIndex - 1]) return endIndex - 1

    let lo = startIndex
    let hi = endIndex - 1

    while (lo <= hi) {
        const mid = Math.round((hi + lo) / 2)

        if (value < array[mid]) {
            hi = mid - 1
        } else if (value > array[mid]) {
            lo = mid + 1
        } else {
            return mid
        }
    }

    // lo == hi + 1
    return array[lo] - value < value - array[hi] ? lo : hi
}

export const sortedFindClosest = (
    array: number[],
    value: number,
    startIndex?: number,
    endIndex?: number
): number | undefined => {
    const index = sortedFindClosestIndex(array, value, startIndex, endIndex)
    return index !== -1 ? array[index] : undefined
}

export const isMobile = (): boolean =>
    typeof window === "undefined"
        ? false
        : !!window?.navigator?.userAgent.toLowerCase().includes("mobi")

export const isTouchDevice = (): boolean => !!("ontouchstart" in window)

// General type representing arbitrary json data; basically a non-nullable 'any'
export interface Json {
    [x: string]: any
}

// Escape a function for storage in a csv cell
export const csvEscape = (value: unknown): string => {
    const valueStr = toString(value)
    return valueStr.includes(",")
        ? `"${valueStr.replace(/\"/g, '""')}"`
        : valueStr
}

export const urlToSlug = (url: string): string =>
    last(
        parseUrl(url)
            .pathname.split("/")
            .filter((x) => x)
    ) as string

// Removes all undefineds from an object.
export const trimObject = <Obj>(
    obj: Obj,
    trimStringEmptyStrings = false
): NoUndefinedValues<Obj> => {
    const clone: any = {}
    for (const key in obj) {
        const val = obj[key] as any
        if (isObject(val) && isEmpty(val)) {
            // Drop empty objects
        } else if (trimStringEmptyStrings && val === "") {
        } else if (val !== undefined) clone[key] = obj[key]
    }
    return clone
}

export const fetchText = async (url: string): Promise<string> => {
    return await fetch(url).then((res) => {
        if (!res.ok)
            throw new Error(`Fetch failed: ${res.status} ${res.statusText}`)
        return res.text()
    })
}

export const getCountryCodeFromNetlifyRedirect = async (): Promise<
    string | undefined
> =>
    await fetch("/detect-country-redirect").then((res) => {
        if (!res.ok) throw new Error("Couldn't retrieve country code")
        return res.url.split("?")[1]
    })

export const stripHTML = (html: string): string => striptags(html)

// Math.rand doesn't have between nor seed. Lodash's Random doesn't take a seed, making it bad for testing.
// So we have our own *very* psuedo-RNG.
export const getRandomNumberGenerator =
    (min: Integer = 0, max: Integer = 100, seed = Date.now()) =>
    (): Integer => {
        const semiRand = Math.sin(seed++) * 10000
        return Math.floor(min + (max - min) * (semiRand - Math.floor(semiRand)))
    }

export const sampleFrom = <T>(
    collection: T[],
    howMany: number,
    seed: number
): T[] => shuffleArray(collection, seed).slice(0, howMany)

// A seeded array shuffle
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
const shuffleArray = <T>(array: T[], seed = Date.now()): T[] => {
    const rand = getRandomNumberGenerator(0, 100, seed)
    const clonedArr = array.slice()
    for (let index = clonedArr.length - 1; index > 0; index--) {
        const replacerIndex = Math.floor((rand() / 100) * (index + 1))
        ;[clonedArr[index], clonedArr[replacerIndex]] = [
            clonedArr[replacerIndex],
            clonedArr[index],
        ]
    }
    return clonedArr
}

export const getIdealGridParams = ({
    count,
    containerAspectRatio,
    idealAspectRatio = IDEAL_PLOT_ASPECT_RATIO,
}: {
    count: number
    containerAspectRatio: number
    idealAspectRatio?: number
}): GridParameters => {
    // See Observable notebook: https://observablehq.com/@danielgavrilov/pack-rectangles-of-a-preferred-aspect-ratio
    // Also Desmos graph: https://www.desmos.com/calculator/tmajzuq5tm
    const ratio = containerAspectRatio / idealAspectRatio
    // Prefer vertical grid for count=2.
    if (count === 2 && ratio < 2) return { rows: 2, columns: 1 }
    // Otherwise, optimize for closest to the ideal aspect ratio.
    const initialColumns = Math.min(Math.round(Math.sqrt(count * ratio)), count)
    const rows = Math.ceil(count / initialColumns)
    // Remove extra columns if we can fit everything in fewer.
    // This will result in wider aspect ratios than ideal, which is ok.
    const columns = Math.ceil(count / rows)
    return {
        rows,
        columns,
    }
}

export const findClosestTimeIndex = (
    times: Time[],
    targetTime: Time,
    tolerance?: number
): Time | undefined => {
    let closest: Time | undefined
    let closestIndex: number | undefined
    for (let index = 0; index < times.length; index++) {
        const time = times[index]
        const currentTimeDist = Math.abs(time - targetTime)
        if (currentTimeDist === 0) return index // Found the winner, stop searching.
        if (tolerance !== undefined && currentTimeDist > tolerance) continue

        const closestTimeDist =
            closest !== undefined ? Math.abs(closest - targetTime) : Infinity

        if (
            closest === undefined ||
            closestTimeDist > currentTimeDist ||
            // Prefer later times, e.g. if targetTime is 2010, prefer 2011 to 2009
            (closestTimeDist === currentTimeDist && time > closest)
        ) {
            closest = time
            closestIndex = index
        }
    }
    return closestIndex
}

export const isNegativeInfinity = (
    timeBound: TimeBound
): timeBound is TimeBoundValue => timeBound === TimeBoundValue.negativeInfinity

export const isPositiveInfinity = (
    timeBound: TimeBound
): timeBound is TimeBoundValue => timeBound === TimeBoundValue.positiveInfinity

export const findClosestTime = (
    times: Time[],
    targetTime: Time,
    tolerance?: number
): Time | undefined => {
    if (isNegativeInfinity(targetTime)) return min(times)
    if (isPositiveInfinity(targetTime)) return max(times)
    const index = findClosestTimeIndex(times, targetTime, tolerance)
    return index !== undefined ? times[index] : undefined
}

// _.mapValues() equivalent for ES6 Maps
export const es6mapValues = <K, V, M>(
    input: Map<K, V>,
    mapper: (value: V, key: K) => M
): Map<K, M> =>
    new Map(
        Array.from(input, ([key, value]) => {
            return [key, mapper(value, key)]
        })
    )

export interface DataValue {
    time: Time | undefined
    value: number | string | undefined
}

const valuesAtTimes = (
    valueByTime: Map<number, string | number>,
    targetTimes: Time[],
    tolerance = 0
): { time: number | undefined; value: string | number | undefined }[] => {
    const times = Array.from(valueByTime.keys())
    return targetTimes.map((targetTime) => {
        const time = findClosestTime(times, targetTime, tolerance)
        const value = time === undefined ? undefined : valueByTime.get(time)
        return {
            time,
            value,
        }
    })
}

export const valuesByEntityAtTimes = (
    valueByEntityAndTime: Map<string, Map<number, string | number>>,
    targetTimes: Time[],
    tolerance = 0
): Map<string, DataValue[]> =>
    es6mapValues(valueByEntityAndTime, (valueByTime) =>
        valuesAtTimes(valueByTime, targetTimes, tolerance)
    )

export const valuesByEntityWithinTimes = (
    valueByEntityAndTimes: Map<string, Map<number, string | number>>,
    range: (number | undefined)[]
): Map<string, DataValue[]> => {
    const start = range[0] !== undefined ? range[0] : -Infinity
    const end = range[1] !== undefined ? range[1] : Infinity
    return es6mapValues(valueByEntityAndTimes, (valueByTime) =>
        Array.from(valueByTime.keys())
            .filter((time) => time >= start && time <= end)
            .map((time) => ({
                time,
                value: valueByTime.get(time),
            }))
    )
}

export const getStartEndValues = (
    values: DataValue[]
): (DataValue | undefined)[] => [
    minBy(values, (dv) => dv.time),
    maxBy(values, (dv) => dv.time),
]

const MS_PER_DAY = 1000 * 60 * 60 * 24

// From https://stackoverflow.com/a/15289883
export function dateDiffInDays(a: Date, b: Date): number {
    // Discard the time and time-zone information.
    const utca = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
    const utcb = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
    return Math.floor((utca - utcb) / MS_PER_DAY)
}

export const diffDateISOStringInDays = (a: string, b: string): number =>
    dayjs.utc(a).diff(dayjs.utc(b), "day")

export const getYearFromISOStringAndDayOffset = (
    epoch: string,
    daysOffset: number
): number => {
    const date = dayjs.utc(epoch).add(daysOffset, "day")
    return date.year()
}

export const addDays = (date: Date, days: number): Date => {
    const newDate = new Date(date.getTime())
    newDate.setDate(newDate.getDate() + days)
    return newDate
}

export async function retryPromise<T>(
    promiseGetter: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    let retried = 0
    let lastError
    while (retried++ < maxRetries) {
        try {
            return await promiseGetter()
        } catch (error) {
            lastError = error
        }
    }
    throw lastError
}

export function parseIntOrUndefined(s: string | undefined): number | undefined {
    if (s === undefined) return undefined
    const value = parseInt(s)
    return isNaN(value) ? undefined : value
}

export const anyToString = (value: unknown): string => {
    if (typeof value === "undefined" || value === null) return ""
    return String(value)
}

// Scroll Helpers
// Borrowed from: https://github.com/JedWatson/react-select/blob/32ad5c040b/packages/react-select/src/utils.js

function isDocumentElement(el: HTMLElement): boolean {
    return [document.documentElement, document.body].indexOf(el) > -1
}

function scrollTo(el: HTMLElement, top: number): void {
    // with a scroll distance, we perform scroll on the element
    if (isDocumentElement(el)) {
        window.scrollTo(0, top)
        return
    }

    el.scrollTop = top
}

export function scrollIntoViewIfNeeded(
    containerEl: HTMLElement,
    focusedEl: HTMLElement
): void {
    const menuRect = containerEl.getBoundingClientRect()
    const focusedRect = focusedEl.getBoundingClientRect()
    const overScroll = focusedEl.offsetHeight / 3

    if (focusedRect.bottom + overScroll > menuRect.bottom) {
        scrollTo(
            containerEl,
            Math.min(
                focusedEl.offsetTop +
                    focusedEl.clientHeight -
                    containerEl.offsetHeight +
                    overScroll,
                containerEl.scrollHeight
            )
        )
    } else if (focusedRect.top - overScroll < menuRect.top) {
        scrollTo(containerEl, Math.max(focusedEl.offsetTop - overScroll, 0))
    }
}

export function rollingMap<T, U>(array: T[], mapper: (a: T, b: T) => U): U[] {
    const result: U[] = []
    if (array.length <= 1) return result
    for (let i = 0; i < array.length - 1; i++) {
        result.push(mapper(array[i], array[i + 1]))
    }
    return result
}

export function groupMap<T, K>(array: T[], accessor: (v: T) => K): Map<K, T[]> {
    const result = new Map<K, T[]>()
    array.forEach((item) => {
        const key = accessor(item)
        if (result.has(key)) {
            result.get(key)?.push(item)
        } else {
            result.set(key, [item])
        }
    })
    return result
}

export function keyMap<Key, Value>(
    array: Value[],
    accessor: (v: Value) => Key
): Map<Key, Value> {
    const result = new Map<Key, Value>()
    array.forEach((item) => {
        const key = accessor(item)
        if (!result.has(key)) {
            result.set(key, item)
        }
    })
    return result
}

export const linkify = (str: string): string => linkifyHtml(str)

export const oneOf = <T>(value: unknown, options: T[], defaultOption: T): T => {
    for (const option of options) {
        if (value === option) return option
    }
    return defaultOption
}

export const intersectionOfSets = <T>(sets: Set<T>[]): Set<T> => {
    if (!sets.length) return new Set<T>()
    const intersection = new Set<T>(sets[0])

    sets.slice(1).forEach((set) => {
        for (const elem of intersection) {
            if (!set.has(elem)) {
                intersection.delete(elem)
            }
        }
    })
    return intersection
}

export const unionOfSets = <T>(sets: Set<T>[]): Set<T> => {
    if (!sets.length) return new Set<T>()
    const unionSet = new Set<T>(...sets)
    return unionSet
}

export const differenceOfSets = <T>(sets: Set<T>[]): Set<T> => {
    if (!sets.length) return new Set<T>()
    const diff = new Set<T>(sets[0])

    sets.slice(1).forEach((set) => {
        for (const elem of set) {
            diff.delete(elem)
        }
    })
    return diff
}

/** Tests whether the first argument is a strict subset of the second. The arguments do not have
    to be sets yet, they can be any iterable. Sets will be created by the function internally */
export function isSubsetOf<T>(
    subsetIter: Iterable<T>,
    supersetIter: Iterable<T>
): boolean {
    const subset = new Set(subsetIter)
    const superset = new Set(supersetIter)
    return intersectionOfSets([subset, superset]).size === subset.size
}

// ES6 is now significantly faster than lodash's intersection
export const intersection = <T>(...arrs: T[][]): T[] => {
    if (arrs.length === 0) return []
    if (arrs.length === 1) return arrs[0]
    if (arrs.length === 2) {
        const set = new Set(arrs[0])
        return arrs[1].filter((value) => set.has(value))
    }
    return intersection(arrs[0], intersection(...arrs.slice(1)))
}

export function sortByUndefinedLast<T>(
    array: T[],
    accessor: (t: T) => string | number | undefined,
    order: SortOrder = SortOrder.asc
): T[] {
    const sorted = sortBy(array, (value) => {
        const mapped = accessor(value)
        if (mapped === undefined) {
            return order === SortOrder.asc ? Infinity : -Infinity
        }
        return mapped
    })
    return order === SortOrder.asc ? sorted : sorted.reverse()
}

export const mapNullToUndefined = <T>(
    array: (T | undefined | null)[]
): (T | undefined)[] => array.map((v) => (v === null ? undefined : v))

export const lowerCaseFirstLetterUnlessAbbreviation = (str: string): string =>
    str.charAt(1).match(/[A-Z]/)
        ? str
        : str.charAt(0).toLowerCase() + str.slice(1)

/**
 * Use with caution - please note that this sort function only sorts on numeric data, and that sorts
 * **in-place** and **not stable**.
 * If you need a more general sort function that is stable and leaves the original array untouched,
 * please use lodash's `sortBy` instead. This function is faster, though.
 */
export const sortNumeric = <T>(
    arr: T[],
    sortByFn: (el: T) => number = identity,
    sortOrder: SortOrder = SortOrder.asc
): T[] =>
    arr.sort(
        sortOrder === SortOrder.asc
            ? (a: T, b: T): number => sortByFn(a) - sortByFn(b)
            : (a: T, b: T): number => sortByFn(b) - sortByFn(a)
    )

export const mapBy = <T, K, V>(
    arr: T[],
    keyAccessor: (t: T) => K,
    valueAccessor: (t: T) => V
): Map<K, V> => {
    const map = new Map<K, V>()
    arr.forEach((val) => {
        map.set(keyAccessor(val), valueAccessor(val))
    })
    return map
}

// Adapted from lodash baseFindIndex which is ~2x as fast as the wrapped findIndex
export const findIndexFast = (
    array: unknown[],
    predicate: (value: unknown, index: number) => boolean,
    fromIndex = 0,
    toIndex = array.length
): number => {
    let index = fromIndex
    while (index < toIndex) {
        if (predicate(array[index], index)) return index
        index++
    }
    return -1
}

export const logMe = (
    target: unknown,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<any>
): TypedPropertyDescriptor<any> => {
    const originalMethod = descriptor.value
    descriptor.value = function (...args: any[]): any {
        // eslint-disable-next-line no-console
        console.log(`Running ${propertyName} with '${args}'`)
        return originalMethod.apply(this, args)
    }
    return descriptor
}

export function getClosestTimePairs(
    sortedTimesA: Time[],
    sortedTimesB: Time[],
    maxDiff: Integer = Infinity
): [number, number][] {
    if (sortedTimesA.length === 0 || sortedTimesB.length === 0) return []

    const decidedPairs: [Time, Time][] = []
    const undecidedPairs: [Time, Time][] = []

    let indexB = 0

    for (let indexA = 0; indexA < sortedTimesA.length; indexA++) {
        const timeA = sortedTimesA[indexA]

        const closestIndexInB = sortedFindClosestIndex(
            sortedTimesB,
            timeA,
            indexB
        )

        /**
         * the index that holds the value that is definitely lower than timeA, the candidate time
         */
        const lowCandidateIndexB =
            sortedTimesB[closestIndexInB] < timeA
                ? closestIndexInB
                : closestIndexInB > indexB
                ? closestIndexInB - 1
                : undefined

        /**
         * the index that holds the value that is definitely equal to or greater than timeA, the candidate time
         */
        const highCandidateIndexB =
            sortedTimesB[closestIndexInB] >= timeA ? closestIndexInB : undefined

        if (
            lowCandidateIndexB !== undefined &&
            highCandidateIndexB !== undefined &&
            timeA - sortedTimesB[lowCandidateIndexB] <= maxDiff &&
            timeA - sortedTimesB[lowCandidateIndexB] <
                sortedTimesB[highCandidateIndexB] - timeA
        ) {
            decidedPairs.push([timeA, sortedTimesB[lowCandidateIndexB]])
        } else if (
            highCandidateIndexB !== undefined &&
            timeA === sortedTimesB[highCandidateIndexB]
        ) {
            decidedPairs.push([timeA, sortedTimesB[highCandidateIndexB]])
        } else {
            if (
                lowCandidateIndexB !== undefined &&
                timeA - sortedTimesB[lowCandidateIndexB] <= maxDiff
            ) {
                undecidedPairs.push([timeA, sortedTimesB[lowCandidateIndexB]])
            }
            if (
                highCandidateIndexB !== undefined &&
                sortedTimesB[highCandidateIndexB] - timeA <= maxDiff
            ) {
                undecidedPairs.push([timeA, sortedTimesB[highCandidateIndexB]])
            }
        }

        indexB = closestIndexInB
    }

    const seenTimes = new Set(flatten(decidedPairs))

    sortBy(undecidedPairs, (pair) => Math.abs(pair[0] - pair[1])).forEach(
        (pair) => {
            if (!seenTimes.has(pair[0]) && !seenTimes.has(pair[1])) {
                decidedPairs.push(pair)
                seenTimes.add(pair[0])
                seenTimes.add(pair[1])
            }
        }
    )

    return decidedPairs
}

export const omitUndefinedValues = <T>(object: T): NoUndefinedValues<T> => {
    const result: any = {}
    for (const key in object) {
        if (object[key] !== undefined) result[key] = object[key]
    }
    return result
}

export const omitNullableValues = <T>(object: T): NoUndefinedValues<T> => {
    const result: any = {}
    for (const key in object) {
        if (object[key] !== undefined && object[key] !== null) {
            result[key] = object[key]
        }
    }
    return result
}

export const isInIFrame = (): boolean => {
    try {
        return window.self !== window.top
    } catch (e) {
        return false
    }
}

export const differenceObj = <A extends Record<string, unknown>>(
    obj: A,
    defaultObj: Record<string, unknown>
): Partial<A> => {
    const result: Partial<A> = {}
    for (const key in obj) {
        if (defaultObj[key] !== obj[key]) {
            result[key] = obj[key]
        }
    }
    return result
}

export const findDOMParent = (
    el: HTMLElement,
    condition: (el: HTMLElement) => boolean
): HTMLElement | null => {
    let current: HTMLElement | null = el
    while (current) {
        if (condition(current)) return current
        current = current.parentElement
    }
    return null
}

export const wrapInDiv = (el: Element, classes?: string[]): Element => {
    if (!el.parentNode) return el
    const wrapper = document.createElement("div")
    if (classes) wrapper.classList.add(...classes)
    el.parentNode.insertBefore(wrapper, el)
    wrapper.appendChild(el)
    return wrapper
}

export const textAnchorFromAlign = (
    align: HorizontalAlign
): "start" | "middle" | "end" => {
    if (align === HorizontalAlign.center) return "middle"
    if (align === HorizontalAlign.right) return "end"
    return "start"
}

export const dyFromAlign = (align: VerticalAlign): string => {
    if (align === VerticalAlign.middle) return ".32em"
    if (align === VerticalAlign.bottom) return ".71em"
    return "0"
}

export const values = <Obj extends Record<string, any>>(
    obj: Obj
): Obj[keyof Obj][] => {
    return Object.values(obj)
}

export function stringifyUnkownError(error: unknown): string | undefined {
    if (error === undefined || error === null) return undefined
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === "function") {
        // Within this branch, `error` has type `Function`,
        // so we can access the function's `name` property
        const functionName = error.name || "(anonymous)"
        return `[function ${functionName}]`
    }

    if (error instanceof Date) {
        // Within this branch, `error` has type `Date`,
        // so we can call the `toISOString` method
        return error.toISOString()
    }

    if (typeof error === "object" && !Array.isArray(error) && error !== null) {
        if (error.hasOwnProperty("message")) {
            // Within this branch, `error` is an object with the `message`
            // property, so we can access the object's `message` property.
            return (error as any).message
        } else {
            // Otherwise, `error` is an object with an unknown structure, so
            // we stringify it.
            return JSON.stringify(error)
        }
    }

    return String(error)
}

/**
 * Turns a 2D array that is not necessarily rectangular into a rectangular array
 * by appending missing values and filling them with `fill`.
 */
export function toRectangularMatrix<T, F>(arr: T[][], fill: F): (T | F)[][] {
    if (arr.length === 0) return []
    const width = max(arr.map((row) => row.length)) as number

    return arr.map((row) => {
        if (row.length < width)
            return [...row, ...Array(width - row.length).fill(fill)]
        else return row
    })
}

export function checkIsPlainObjectWithGuard(
    x: unknown
): x is Record<string, unknown> {
    return isPlainObject(x)
}

export function checkIsStringIndexable(
    x: unknown
): x is Record<string, unknown> {
    return isPlainObject(x) || isArray(x)
}

function checkIsTouchEvent(
    event: unknown
): event is React.TouchEvent | TouchEvent {
    if (isObject(event)) {
        return "targetTouches" in event
    }
    return false
}

export const triggerDownloadFromBlob = (filename: string, blob: Blob): void => {
    const objectUrl = URL.createObjectURL(blob)
    triggerDownloadFromUrl(filename, objectUrl)
    URL.revokeObjectURL(objectUrl)
}

export const triggerDownloadFromUrl = (filename: string, url: string): void => {
    const downloadLink = document.createElement("a")
    downloadLink.setAttribute("href", url)
    downloadLink.setAttribute("download", filename)
    downloadLink.click()
}

export const removeAllWhitespace = (text: string): string => {
    return text.replace(/\s+|\n/g, "")
}

export function moveArrayItemToIndex<Item>(
    arr: Item[],
    fromIndex: number,
    toIndex: number
): Item[] {
    const newArray = Array.from(arr)
    const [removed] = newArray.splice(fromIndex, 1)
    newArray.splice(toIndex, 0, removed)
    return newArray
}

export const getIndexableKeys = Object.keys as <T extends object>(
    obj: T
) => Array<keyof T>

export const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "2-digit",
    })
}

/**
 *
 * Parses a gdoc article JSON with non-primitive types (Date)
 *
 * Note: if dates could also be found deeper in the JSON, it could make sense to
 * write a custom JSON parser to handle that automatically for all keys. At this
 * stage, the manual approach is probably simpler.
 */
export const getOwidGdocFromJSON = (json: OwidGdocJSON): OwidGdocInterface => {
    return {
        ...json,
        createdAt: new Date(json.createdAt),
        publishedAt: json.publishedAt ? new Date(json.publishedAt) : null,
        updatedAt: json.updatedAt ? new Date(json.updatedAt) : null,
    }
}

// Checking whether we have clipboard write access is surprisingly complicated.
// For example, if a chart is embedded in an iframe, then Chrome will prevent the
// use of clipboard.writeText() unless the iframe has allow="clipboard-write".
// On the other hand, Firefox and Safari haven't implemented the Permissions API
// for "clipboard-write", so we need to handle that case gracefully.
// See https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API#browser_compatibility
export const canWriteToClipboard = async (): Promise<boolean> => {
    if (!("clipboard" in navigator)) return false

    if ("permissions" in navigator) {
        // Is Permissions API implemented?

        try {
            // clipboard-write permission is not supported in all browsers - need to catch that case
            const res = await navigator.permissions.query({
                name: "clipboard-write" as PermissionName,
            })

            // Asking permission was successful, we may use clipboard-write methods if permission wasn't denied.
            return ["granted", "prompt"].includes(res.state)
        } catch (err) {}
    }
    // navigator.clipboard is available, but we couldn't check for permissions -- assume we can use it.
    return true
}

export function findDuplicates<T>(arr: T[]): T[] {
    const set = new Set()
    const duplicates: Set<T> = new Set()
    arr.forEach((item) => {
        if (set.has(item)) {
            if (!duplicates.has(item)) {
                duplicates.add(item)
            }
        } else {
            set.add(item)
        }
    })
    return [...duplicates]
}

// Memoization for immutable getters. Run the function once for this instance and cache the result.
export const imemo = <Type>(
    target: unknown,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<Type>
): void => {
    const originalFn = descriptor.get!
    descriptor.get = function (this: Record<string, Type>): Type {
        const propName = `${propertyName}_memoized`
        if (this[propName] === undefined) {
            // Define the prop the long way so we don't enumerate over it
            Object.defineProperty(this, propName, {
                configurable: false,
                enumerable: false,
                writable: false,
                value: originalFn.apply(this),
            })
        }
        return this[propName]
    }
}

// These are all the types that we need to be able to iterate through to extract their URLs.
// It's more than just the EnrichedBlocks and Spans, because some EnrichedBlocks have nested children
// that contain URLs
export type NodeWithUrl =
    | OwidEnrichedGdocBlock
    | Span
    | EnrichedRecircLink
    | EnrichedTopicPageIntroRelatedTopic
    | EnrichedTopicPageIntroDownloadButton
    | EnrichedScrollerItem

export function recursivelyMapArticleContent(
    node: NodeWithUrl,
    callback: (node: NodeWithUrl) => NodeWithUrl
): NodeWithUrl {
    if (checkNodeIsSpan(node)) {
        if ("children" in node) {
            node.children.map((node) =>
                recursivelyMapArticleContent(node, callback)
            )
        }
    } else if (node.type === "gray-section") {
        node.items.map((block) => recursivelyMapArticleContent(block, callback))
    } else if (
        node.type === "sticky-left" ||
        node.type === "sticky-right" ||
        node.type === "side-by-side"
    ) {
        node.left.map((node) => recursivelyMapArticleContent(node, callback))
        node.right.map((node) => recursivelyMapArticleContent(node, callback))
    } else if (node.type === "text") {
        node.value.map((node) => recursivelyMapArticleContent(node, callback))
    } else if (node.type === "additional-charts") {
        node.items.map((spans) =>
            spans.map((span) => recursivelyMapArticleContent(span, callback))
        )
    } else if (node.type === "chart-story") {
        node.items.map((item) =>
            recursivelyMapArticleContent(item.chart, callback)
        )
    } else if (node.type === "recirc") {
        node.links.map((link) => callback(link))
    } else if (node.type === "topic-page-intro") {
        const { downloadButton, relatedTopics, content } = node
        if (downloadButton) callback(downloadButton)
        if (relatedTopics) relatedTopics.forEach(callback)
        content.forEach(callback)
    } else if (node.type === "scroller") {
        node.blocks.forEach(callback)
    }

    return callback(node)
}

export function checkNodeIsSpan(node: NodeWithUrl): node is Span {
    return "spanType" in node
}

export function spansToUnformattedPlainText(spans: Span[]): string {
    return spans
        .map((span) =>
            match(span)
                .with({ spanType: "span-simple-text" }, (span) => span.text)
                .with(
                    {
                        spanType: P.union(
                            "span-link",
                            "span-italic",
                            "span-bold",
                            "span-fallback",
                            "span-quote",
                            "span-superscript",
                            "span-subscript",
                            "span-underline",
                            "span-ref"
                        ),
                    },
                    (span) => spansToUnformattedPlainText(span.children)
                )
                .with({ spanType: "span-newline" }, () => "")
                .exhaustive()
        )
        .join("")
}

export function checkIsOwidGdocType(
    documentType: unknown
): documentType is OwidGdocType {
    return Object.values(OwidGdocType).includes(documentType as any)
}

export function isArrayOfNumbers(arr: unknown[]): arr is number[] {
    return arr.every((item) => typeof item === "number")
}

export function greatestCommonDivisor(a: number, b: number): number {
    if (a === 0) return Math.abs(b)
    return greatestCommonDivisor(b % a, a)
}

export function findGreatestCommonDivisorOfArray(arr: number[]): number | null {
    if (arr.length === 0) return null
    if (arr.includes(1)) return 1
    return uniq(arr).reduce((acc, num) => greatestCommonDivisor(acc, num))
}
