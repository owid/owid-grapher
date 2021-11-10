// We're importing every item on its own to enable webpack tree shaking
import capitalize from "lodash/capitalize"
import chunk from "lodash/chunk"
import clone from "lodash/clone"
import cloneDeep from "lodash/cloneDeep"
import compact from "lodash/compact"
import countBy from "lodash/countBy"
import debounce from "lodash/debounce"
import difference from "lodash/difference"
import drop from "lodash/drop"
import extend from "lodash/extend"
import findIndex from "lodash/findIndex"
import findLastIndex from "lodash/findLastIndex"
import flatten from "lodash/flatten"
import groupBy from "lodash/groupBy"
import identity from "lodash/identity"
import invert from "lodash/invert"
import isEmpty from "lodash/isEmpty"
import isEqual from "lodash/isEqual"
import isNumber from "lodash/isNumber"
import isObject from "lodash/isObject"
import isString from "lodash/isString"
import keyBy from "lodash/keyBy"
import mapValues from "lodash/mapValues"
import max from "lodash/max"
import maxBy from "lodash/maxBy"
import memoize from "lodash/memoize"
import min from "lodash/min"
import minBy from "lodash/minBy"
import noop from "lodash/noop"
import omit from "lodash/omit"
import once from "lodash/once"
import orderBy from "lodash/orderBy"
import partition from "lodash/partition"
import pick from "lodash/pick"
import range from "lodash/range"
import reverse from "lodash/reverse"
import round from "lodash/round"
import sample from "lodash/sample"
import sampleSize from "lodash/sampleSize"
import sortBy from "lodash/sortBy"
import startCase from "lodash/startCase"
import sum from "lodash/sum"
import sumBy from "lodash/sumBy"
import takeWhile from "lodash/takeWhile"
import throttle from "lodash/throttle"
import toString from "lodash/toString"
import union from "lodash/union"
import uniq from "lodash/uniq"
import uniqBy from "lodash/uniqBy"
import uniqWith from "lodash/uniqWith"
import upperFirst from "lodash/upperFirst"
import without from "lodash/without"
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
    extend,
    findIndex,
    findLastIndex,
    flatten,
    groupBy,
    identity,
    invert,
    isEmpty,
    isEqual,
    isNumber,
    isString,
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
    sortBy,
    startCase,
    sum,
    sumBy,
    takeWhile,
    throttle,
    toString,
    union,
    uniq,
    uniqBy,
    uniqWith,
    upperFirst,
    without,
}
import { extent, pairs } from "d3-array"
export { pairs }
import moment from "moment"
import { formatLocale } from "d3-format"
import striptags from "striptags"
import parseUrl from "url-parse"
import linkifyHtml from "linkifyjs/html"
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
} from "./owidTypes"
import { PointVector } from "./PointVector"
import { isNegativeInfinity, isPositiveInfinity } from "./TimeBounds"

export type NoUndefinedValues<T> = {
    [P in keyof T]: Required<NonNullable<T[P]>>
}

// d3 v6 changed the default minus sign used in d3-format to "−" (Unicode minus sign), which looks
// nicer but can cause issues when copy-pasting values into a spreadsheet or script.
// For that reason we change that back to a plain old hyphen.
// See https://observablehq.com/@d3/d3v6-migration-guide#minus
export const d3Format = formatLocale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    minus: "-",
    currency: ["$", ""],
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
    event: TouchEvent | { clientX: number; clientY: number }
): PointVector => {
    const isTouchEvent = !!(event as TouchEvent).targetTouches
    const eventOwner = isTouchEvent
        ? (event as TouchEvent).targetTouches[0]
        : (event as MouseEvent)

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
    component: any,
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
    // Use moments' UTC mode https://momentjs.com/docs/#/parsing/utc/
    // This will force moment to format in UTC time instead of local time,
    // making dates consistent no matter what timezone the user is in.
    return moment.utc(EPOCH_DATE).add(dayAsYear, "days").format(format)
}

export const formatYear = (year: number): string => {
    if (isNaN(year)) {
        console.warn(`Invalid year '${year}'`)
        return ""
    }

    return year < 0
        ? `${d3Format(",.0f")(Math.abs(year))} BCE`
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
interface Point {
    timeValue: Time
    entityName?: string
    x?: number
    y?: number
}
// Todo: add unit tests
const cagrFromPoints = (
    startPoint: Point,
    endPoint: Point,
    property: "x" | "y"
): number => {
    const elapsed = endPoint.timeValue - startPoint.timeValue
    if (!elapsed) return 0
    return cagr(startPoint[property]!, endPoint[property]!, elapsed)
}

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

// Todo: add unit tests
export const relativeMinAndMax = (
    points: Point[],
    property: "x" | "y"
): [number, number] => {
    let minChange = 0
    let maxChange = 0

    const filteredPoints = points.filter(
        (point) => point.x !== 0 && point.y !== 0
    )

    for (let i = 0; i < filteredPoints.length; i++) {
        const indexValue = filteredPoints[i]
        for (let j = i + 1; j < filteredPoints.length; j++) {
            const targetValue = filteredPoints[j]

            if (targetValue.entityName !== indexValue.entityName) continue

            const change = cagrFromPoints(indexValue, targetValue, property)
            if (change < minChange) minChange = change
            if (change > maxChange) maxChange = change
        }
    }
    return [minChange, maxChange]
}

export const isVisible = (elm: HTMLElement | null): boolean => {
    if (!elm || !elm.getBoundingClientRect) return false
    const rect = elm.getBoundingClientRect()
    const viewHeight = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight
    )
    return !(rect.bottom < 0 || rect.top - viewHeight >= 0)
}

// Take an arbitrary string and turn it into a nice url slug
export const slugify = (str: string): string =>
    slugifySameCase(str.toLowerCase())
export const slugifySameCase = (str: string): string =>
    str
        .replace(/\s*\*.+\*/, "")
        .replace(/[^\w- ]+/g, "")
        .trim()
        .replace(/ +/g, "-")

// Unique number for this execution context
// Useful for coordinating between embeds to avoid conflicts in their ids
let _guid = 0
export const guid = (): number => ++_guid
export const TESTING_ONLY_reset_guid = () => (_guid = 0)

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

// General type reperesenting arbitrary json data; basically a non-nullable 'any'
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

export const arrToCsvRow = (arr: string[]): string =>
    arr.map((x) => csvEscape(x)).join(",") + "\n"

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

// TODO use fetchText() in fetchJSON()
// decided not to do this while implementing our COVID-19 page in order to prevent breaking something.
export const fetchText = async (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest()
        req.addEventListener("load", function () {
            resolve(this.responseText)
        })
        req.addEventListener("readystatechange", () => {
            if (req.readyState === 4) {
                if (req.status !== 200) {
                    reject(new Error(`${req.status} ${req.statusText}`))
                }
            }
        })
        req.open("GET", url)
        req.send()
    })
}

// todo: can we ditch this in favor of a simple fetch?
export const getCountryCodeFromNetlifyRedirect = async (): Promise<
    string | undefined
> =>
    new Promise((resolve, reject) => {
        const req = new XMLHttpRequest()
        req.addEventListener("load", () => {
            resolve(req.responseURL.split("?")[1])
        })
        req.addEventListener("error", () =>
            reject(new Error("Couldn't retrieve country code"))
        )
        req.open("GET", "/detect-country-redirect")
        req.send()
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

interface DataValue {
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
    moment.utc(a).diff(moment.utc(b), "days")

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

export const anyToString = (value: any): string =>
    value?.toString ? value.toString() : ""

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

export function getAttributesOfHTMLElement(el: HTMLElement): {
    [key: string]: string
} {
    const attributes: { [key: string]: string } = {}
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes.item(i)
        if (attr) attributes[attr.name] = attr.value
    }
    return attributes
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
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<any>
): TypedPropertyDescriptor<any> => {
    const originalMethod = descriptor.value
    descriptor.value = function (...args: any[]) {
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

export const isInIFrame = (): boolean => {
    try {
        return window.self !== window.top
    } catch (e) {
        return false
    }
}

export const differenceObj = <
    A extends Record<string, unknown>,
    B extends Record<string, unknown>
>(
    obj: A,
    defaultObj: B
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

export const values = <Obj>(obj: Obj): Obj[keyof Obj][] => {
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

// Wrapped because JSDOM does not support this method yet:
// https://stackoverflow.com/questions/52968969/jest-url-createobjecturl-is-not-a-function/56643520#56643520
export const createObjectURL = (obj: any): string =>
    URL.createObjectURL ? URL.createObjectURL(obj) : ""
export const revokeObjectURL = (obj: any): void =>
    URL.revokeObjectURL ? URL.revokeObjectURL(obj) : undefined

export const triggerDownloadFromBlob = (filename: string, blob: Blob): void => {
    const objectUrl = createObjectURL(blob)
    triggerDownloadFromUrl(filename, objectUrl)
    revokeObjectURL(objectUrl)
}

export const triggerDownloadFromUrl = (filename: string, url: string): void => {
    const downloadLink = document.createElement("a")
    downloadLink.setAttribute("href", url)
    downloadLink.setAttribute("download", filename)
    downloadLink.click()
}
