// We're importing every item on its own to enable webpack tree shaking
import assign from "lodash/assign"
import capitalize from "lodash/capitalize"
import clone from "lodash/clone"
import cloneDeep from "lodash/cloneDeep"
import compact from "lodash/compact"
import countBy from "lodash/countBy"
import debounce from "lodash/debounce"
import difference from "lodash/difference"
import extend from "lodash/extend"
import flatten from "lodash/flatten"
import fromPairs from "lodash/fromPairs"
import groupBy from "lodash/groupBy"
import has from "lodash/has"
import identity from "lodash/identity"
import intersection from "lodash/intersection"
import isEmpty from "lodash/isEmpty"
import isEqual from "lodash/isEqual"
import isNumber from "lodash/isNumber"
import isString from "lodash/isString"
import keyBy from "lodash/keyBy"
import map from "lodash/map"
import mapKeys from "lodash/mapKeys"
import max from "lodash/max"
import maxBy from "lodash/maxBy"
import memoize from "lodash/memoize"
import min from "lodash/min"
import minBy from "lodash/minBy"
import noop from "lodash/noop"
import omit from "lodash/omit"
import orderBy from "lodash/orderBy"
import partition from "lodash/partition"
import pick from "lodash/pick"
import range from "lodash/range"
import reverse from "lodash/reverse"
import round from "lodash/round"
import sample from "lodash/sample"
import sampleSize from "lodash/sampleSize"
import sortBy from "lodash/sortBy"
import sortedUniq from "lodash/sortedUniq"
import startCase from "lodash/startCase"
import sum from "lodash/sum"
import sumBy from "lodash/sumBy"
import takeWhile from "lodash/takeWhile"
import throttle from "lodash/throttle"
import toArray from "lodash/toArray"
import toString from "lodash/toString"
import union from "lodash/union"
import uniq from "lodash/uniq"
import uniqBy from "lodash/uniqBy"
import uniqWith from "lodash/uniqWith"
import upperFirst from "lodash/upperFirst"
import without from "lodash/without"
import xor from "lodash/xor"

export {
    capitalize,
    clone,
    cloneDeep,
    compact,
    countBy,
    debounce,
    difference,
    extend,
    flatten,
    fromPairs,
    groupBy,
    has,
    identity,
    intersection,
    isEmpty,
    isEqual,
    isNumber,
    isString,
    keyBy,
    map,
    mapKeys,
    max,
    maxBy,
    memoize,
    min,
    minBy,
    noop,
    omit,
    orderBy,
    partition,
    pick,
    range,
    reverse,
    sample,
    sampleSize,
    sortBy,
    sortedUniq,
    startCase,
    sum,
    sumBy,
    takeWhile,
    throttle,
    toArray,
    toString,
    union,
    uniq,
    uniqBy,
    uniqWith,
    upperFirst,
    without,
    xor,
}

import moment from "moment"
import { formatLocale } from "d3-format"
import { extent } from "d3-array"
import striptags from "striptags"
import parseUrl from "url-parse"
import linkifyHtml from "linkifyjs/html"
import { SortOrder } from "coreTable/CoreTableConstants"
import { PointVector } from "./PointVector"
import {
    TickFormattingOptions,
    RelatedQuestionsConfig,
    ScaleType,
    EPOCH_DATE,
    Time,
    Integer,
} from "grapher/core/GrapherConstants"
import { isUnboundedLeft, isUnboundedRight } from "./TimeBounds"
import { queryParamsToStr, strToQueryParams } from "utils/client/url"
import { dsvFormat } from "d3-dsv"
import { isObject } from "lodash"

export type SVGElement = any
export type VNode = any

// A grid is a 2D matrix/array of arrays. The first array is usually a header. It is the basic
// structure used in HandsonTable
export type Grid = any[][]

// A JsTable is a type of Grid where the first row is an array of column names.
declare type HeaderRow = string[]
declare type ValueRow = any[]
export type JsTable = [HeaderRow, ...ValueRow]

// d3 v6 changed the default minus sign used in d3-format to "−" (Unicode minus sign), which looks
// nicer but can cause issues when copy-pasting values into a spreadsheet or script.
// For that reason we change that back to a plain old hyphen.
// See https://observablehq.com/@d3/d3v6-migration-guide#minus
const d3Format = formatLocale({
    decimal: ".",
    thousands: ",",
    grouping: [3],
    minus: "-",
    currency: ["$", ""],
} as any).format

export const getRelativeMouse = (
    node: SVGElement,
    event: TouchEvent | { clientX: number; clientY: number }
) => {
    const isTouchEvent = !!(event as TouchEvent).targetTouches
    const eventOwner = isTouchEvent
        ? (event as TouchEvent).targetTouches[0]
        : (event as MouseEvent)

    const { clientX, clientY } = eventOwner
    const svg = node.ownerSVGElement || node

    if (svg.createSVGPoint) {
        const svgPoint = svg.createSVGPoint()
        svgPoint.x = clientX
        svgPoint.y = clientY
        const point = svgPoint.matrixTransform(node.getScreenCTM().inverse())
        return new PointVector(point.x, point.y)
    }

    const rect = node.getBoundingClientRect()
    return new PointVector(
        clientX - rect.left - node.clientLeft,
        clientY - rect.top - node.clientTop
    )
}

// Purely for local development time
const isStorybook = () =>
    window.location.host.startsWith("localhost:6006") &&
    document.title === "Storybook"

// Just a quick and dirty way to expose window.chart/explorer/etc for debugging. Last caller wins.
export const exposeInstanceOnWindow = (
    component: any,
    name = "chart",
    alsoOnTopWindow?: boolean
) => {
    if (typeof window === "undefined") return
    const win = window as any
    win[name] = component
    alsoOnTopWindow =
        alsoOnTopWindow === undefined ? isStorybook() : alsoOnTopWindow
    if (alsoOnTopWindow && win !== win.top) win.top[name] = component
}

// Make an arbitrary string workable as a css class name
export function makeSafeForCSS(name: string) {
    return name.replace(/[^a-z0-9]/g, (s) => {
        const c = s.charCodeAt(0)
        if (c === 32) return "-"
        if (c === 95) return "_"
        if (c >= 65 && c <= 90) return s
        return "__" + ("000" + c.toString(16)).slice(-4)
    })
}

export function formatDay(
    dayAsYear: number,
    options?: { format?: string }
): string {
    const format = defaultTo(options?.format, "MMM D, YYYY")
    // Use moments' UTC mode https://momentjs.com/docs/#/parsing/utc/
    // This will force moment to format in UTC time instead of local time,
    // making dates consistent no matter what timezone the user is in.
    return moment.utc(EPOCH_DATE).add(dayAsYear, "days").format(format)
}

export function formatYear(year: number): string {
    if (isNaN(year)) {
        console.warn(`Invalid year '${year}'`)
        return ""
    }

    return year < 0
        ? `${d3Format(",.0f")(Math.abs(year))} BCE`
        : year.toString()
}

export function roundSigFig(num: number, sigfigs: number = 1) {
    if (num === 0) return 0
    const magnitude = Math.floor(Math.log10(Math.abs(num)))
    return round(num, -magnitude + sigfigs - 1)
}

// todo: Should this be numberSuffixes instead of Prefixes?
// todo: we should have unit tests for this one. lot's of great features but hard to see how to use all of them.
export function formatValue(
    value: number,
    options: TickFormattingOptions
): string {
    const noTrailingZeroes = defaultTo(options.noTrailingZeroes, true)
    const numberPrefixes = defaultTo(
        options.numberPrefixes || options.shortNumberPrefixes,
        true
    )
    const shortNumberPrefixes = defaultTo(options.shortNumberPrefixes, false)
    const showPlus = defaultTo(options.showPlus, false)
    const numDecimalPlaces = defaultTo(options.numDecimalPlaces, 2)
    const unit = defaultTo(options.unit, "")
    const isNoSpaceUnit = defaultTo(options.noSpaceUnit, unit[0] === "%")

    let output: string = value.toString()

    const absValue = Math.abs(value)
    if (!isNoSpaceUnit && numberPrefixes && absValue >= 1e6) {
        if (!isFinite(absValue)) output = "Infinity"
        else if (absValue >= 1e12)
            output = formatValue(value / 1e12, {
                ...options,
                unit: shortNumberPrefixes ? "T" : "trillion",
                noSpaceUnit: shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
        else if (absValue >= 1e9)
            output = formatValue(value / 1e9, {
                ...options,
                unit: shortNumberPrefixes ? "B" : "billion",
                noSpaceUnit: shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
        else if (absValue >= 1e6)
            output = formatValue(value / 1e6, {
                ...options,
                unit: shortNumberPrefixes ? "M" : "million",
                noSpaceUnit: shortNumberPrefixes,
                numDecimalPlaces: 2,
            })
    } else {
        const targetDigits = Math.pow(10, -numDecimalPlaces)

        if (value !== 0 && Math.abs(value) < targetDigits) {
            if (value < 0) output = `>-${targetDigits}`
            else output = `<${targetDigits}`
        } else {
            output = d3Format(`${showPlus ? "+" : ""},.${numDecimalPlaces}f`)(
                value
            )
        }

        if (noTrailingZeroes) {
            // Convert e.g. 2.200 to 2.2
            const m = output.match(/(.*?[0-9,-]+.[0-9,]*?)0*$/)
            if (m) output = m[1]
            if (output[output.length - 1] === ".")
                output = output.slice(0, output.length - 1)
        }
    }

    if (unit === "$" || unit === "£") output = unit + output
    else if (isNoSpaceUnit) {
        output = output + unit
    } else if (unit.length > 0) {
        output = output + " " + unit
    }

    return output
}

export function defaultTo<T, K>(
    value: T | undefined | null,
    defaultValue: K
): T | K {
    if (value == null) return defaultValue
    else return value
}

export function first<T>(arr: T[]): T | undefined {
    return arr[0]
}

export function last<T>(arr: T[]): T | undefined {
    return arr[arr.length - 1]
}

export function excludeUndefined<T>(arr: (T | undefined)[]): T[] {
    return arr.filter((x) => x !== undefined) as T[]
}

export function firstOfNonEmptyArray<T>(arr: T[]): T {
    if (arr.length < 1) throw new Error("array is empty")
    return first(arr) as T
}

export function lastOfNonEmptyArray<T>(arr: T[]): T {
    if (arr.length < 1) throw new Error("array is empty")
    return last(arr) as T
}

export function next<T>(set: T[], current: T) {
    let nextIndex = set.indexOf(current) + 1
    nextIndex = nextIndex === -1 ? 0 : nextIndex
    return set[nextIndex === set.length ? 0 : nextIndex]
}

export function previous<T>(set: T[], current: T) {
    const nextIndex = set.indexOf(current) - 1
    return set[nextIndex < 0 ? set.length - 1 : nextIndex]
}

// Calculate the extents of a set of numbers, with safeguards for log scales
export function domainExtent(
    numValues: number[],
    scaleType: ScaleType,
    maxValueMultiplierForPadding = 1
): [number, number] {
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
function cagr(startValue: Point, endValue: Point, property: "x" | "y") {
    const elapsed = endValue.timeValue - startValue.timeValue
    if (!elapsed) return 0

    const frac = endValue[property]! / startValue[property]!
    return Math.sign(frac) * (Math.pow(Math.abs(frac), 1 / elapsed) - 1) * 100
}

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

            const change = cagr(indexValue, targetValue, property)
            if (change < minChange) minChange = change
            if (change > maxChange) maxChange = change
        }
    }
    return [minChange, maxChange]
}

export function isVisible(elm: HTMLElement | null) {
    if (!elm || !elm.getBoundingClientRect) return false
    const rect = elm.getBoundingClientRect()
    const viewHeight = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight
    )
    return !(rect.bottom < 0 || rect.top - viewHeight >= 0)
}

// Take an arbitrary string and turn it into a nice url slug
export const slugify = (str: string) => slugifySameCase(str.toLowerCase())
export const slugifySameCase = (str: string) =>
    str
        .replace(/\s*\*.+\*/, "")
        .replace(/[^\w- ]+/g, "")
        .trim()
        .replace(/ +/g, "-")

// Unique number for this execution context
// Useful for coordinating between embeds to avoid conflicts in their ids
let n = 0
export function guid() {
    n += 1
    return n
}

// Take an array of points and make it into an SVG path specification string
export function pointsToPath(points: Array<[number, number]>) {
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
export function sortedFindClosestIndex(array: number[], value: number) {
    if (array.length === 0) return -1

    if (value < array[0]) return 0

    if (value > array[array.length - 1]) return array.length - 1

    let lo = 0
    let hi = array.length - 1

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

export function isMobile() {
    return typeof window === "undefined"
        ? false
        : !!window?.navigator?.userAgent.toLowerCase().includes("mobi")
}

export function isTouchDevice() {
    return !!("ontouchstart" in window)
}

// General type reperesenting arbitrary json data; basically a non-nullable 'any'
export interface Json {
    [x: string]: any
}

// Escape a function for storage in a csv cell
export function csvEscape(value: any) {
    const valueStr = toString(value)
    if (valueStr.includes(",")) return `"${value.replace(/\"/g, '""')}"`
    return value
}

export function urlToSlug(url: string) {
    const urlobj = parseUrl(url)
    const slug = last(urlobj.pathname.split("/").filter((x) => x)) as string
    return slug
}

export function sign(n: number) {
    return n > 0 ? 1 : n < 0 ? -1 : 0
}

// Removes all undefineds from an object.
export function trimObject(obj: any = {}) {
    const clone: any = {}
    Object.keys(obj).forEach((key) => {
        const val = obj[key]
        if (isObject(val) && isEmpty(val)) {
            // Drop empty objects
        } else if (val !== undefined) clone[key] = obj[key]
    })
    return clone
}

// TODO use fetchText() in fetchJSON()
// decided not to do this while implementing our COVID-19 page in order to prevent breaking something.
export async function fetchText(url: string): Promise<string> {
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

export async function getCountryCodeFromNetlifyRedirect(): Promise<
    string | undefined
> {
    return new Promise((resolve, reject) => {
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
}

export async function fetchJSON(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest()
        req.addEventListener("load", function () {
            resolve(JSON.parse(this.responseText))
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
    // window.fetch() implementation below. Decided to use XMLHttpRequest for
    // the time being, since mocking window.fetch() seemed not to allow
    // specifying an endpoint, rather you just intercept function calls, which
    // feels more verbose.
    // -@danielgavrilov 2019-12-09
    //
    // const response = await window.fetch(url)
    // const result = await response.json()
    // return result
}

export function stripHTML(html: string): string {
    return striptags(html)
}

// Math.rand doesn't have between nor seed. Lodash's Random doesn't take a seed, making it bad for testing.
// So we have our own *very* psuedo-RNG.
export const getRandomNumberGenerator = (
    min: Integer = 0,
    max: Integer = 100,
    seed = Date.now()
) => (): Integer => {
    const semiRand = Math.sin(seed++) * 10000
    return Math.floor(min + (max - min) * (semiRand - Math.floor(semiRand)))
}

// Returns a Set of random indexes to drop in an array, preserving the order of the array
export const getDropIndexes = (
    arrayLength: number,
    howMany: number,
    seed = Date.now()
) => new Set(sampleFrom(range(0, arrayLength), howMany, seed))

export const sampleFrom = <T>(
    collection: T[],
    howMany: number,
    seed: number
): T[] => shuffleArray(collection, seed).slice(0, howMany)

// A seeded array shuffle
// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
const shuffleArray = (array: any[], seed = Date.now()) => {
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

export const makeGrid = (pieces: number) => {
    const columns = Math.ceil(Math.sqrt(pieces))
    const rows = Math.ceil(pieces / columns)
    return {
        columns,
        rows,
    }
}

export function findClosestTimeIndex(
    times: Time[],
    targetTime: Time,
    tolerance?: number
): Time | undefined {
    let closest: Time | undefined
    let closestIndex: number | undefined
    for (const [index, time] of times.entries()) {
        const currentTimeDist = Math.abs(time - targetTime)
        if (!currentTimeDist) return index // Found the winner, stop searching.
        if (tolerance !== undefined && currentTimeDist > tolerance) continue

        const closestTimeDist = closest
            ? Math.abs(closest - targetTime)
            : Infinity

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

export function findClosestTime(
    times: Time[],
    targetTime: Time,
    tolerance?: number
): Time | undefined {
    if (isUnboundedLeft(targetTime)) return min(times)
    if (isUnboundedRight(targetTime)) return max(times)
    const index = findClosestTimeIndex(times, targetTime, tolerance)
    return index !== undefined ? times[index] : undefined
}

// _.mapValues() equivalent for ES6 Maps
export function es6mapValues<K, V, M>(
    input: Map<K, V>,
    mapper: (value: V, key: K) => M
): Map<K, M> {
    return new Map(
        Array.from(input, ([key, value]) => {
            return [key, mapper(value, key)]
        })
    )
}

interface DataValue {
    time: Time | undefined
    value: number | string | undefined
}

function valuesAtTimes(
    valueByTime: Map<number, string | number>,
    targetTimes: Time[],
    tolerance = 0
) {
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

export function valuesByEntityWithinTimes(
    valueByEntityAndTimes: Map<string, Map<number, string | number>>,
    range: (number | undefined)[]
): Map<string, DataValue[]> {
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

export const getStartEndValues = (values: DataValue[]) => [
    minBy(values, (dv) => dv.time),
    maxBy(values, (dv) => dv.time),
]

const MS_PER_DAY = 1000 * 60 * 60 * 24

// From https://stackoverflow.com/a/15289883
export function dateDiffInDays(a: Date, b: Date) {
    // Discard the time and time-zone information.
    const utca = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
    const utcb = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
    return Math.floor((utca - utcb) / MS_PER_DAY)
}

export const diffDateISOStringInDays = (a: string, b: string) =>
    moment.utc(a).diff(moment.utc(b), "days")

export function addDays(date: Date, days: number): Date {
    const newDate = new Date(date.getTime())
    newDate.setDate(newDate.getDate() + days)
    return newDate
}

export async function retryPromise<T>(
    promiseGetter: () => Promise<T>,
    maxRetries: number = 3
) {
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

export function parseIntOrUndefined(s: string | undefined) {
    if (s === undefined) return undefined
    const value = parseInt(s)
    return isNaN(value) ? undefined : value
}

export const parseDelimited = (str: string) =>
    dsvFormat(detectDelimiter(str)).parse(str)

export const detectDelimiter = (str: string) =>
    str.includes("\t") ? "\t" : str.includes(",") ? "," : " "

export const toJsTable = (rows: any[]): JsTable | undefined =>
    rows.length
        ? [
              Object.keys(rows[0]) as HeaderRow,
              ...rows.map((row) => Object.values(row) as ValueRow),
          ]
        : undefined

const isRowEmpty = (row: any[]) => row.every(isCellEmpty)

export const isCellEmpty = (cell: any) =>
    cell === null || cell === undefined || cell === ""

export const trimEmptyRows = (grid: Grid): Grid => {
    let trimAt = undefined
    for (let index = grid.length - 1; index >= 0; index--) {
        if (!isRowEmpty(grid[index])) break
        trimAt = index
    }
    return trimAt === undefined ? grid : grid.slice(0, trimAt)
}

export const trimArray = (arr: any[]) => {
    let index: number
    for (index = arr.length - 1; index >= 0; index--) {
        if (!isCellEmpty(arr[index])) break
    }
    return arr.slice(0, index + 1)
}

export const anyToString = (value: any): string =>
    value?.toString ? value.toString() : ""

const trimEmptyColumns = (grid: Grid): Grid => grid.map(trimArray)
export const trimGrid = (grid: Grid): Grid =>
    trimEmptyColumns(trimEmptyRows(grid))

export const jsTableToDelimited = (table: JsTable, delimiter = "\t") => {
    return table
        .map((row: any) =>
            row
                .map((cell: any) =>
                    cell === null || cell === undefined ? "" : cell
                )
                .join(delimiter)
        )
        .join("\n")
}

export function parseFloatOrUndefined(s: string | undefined) {
    if (s === undefined) return undefined
    const value = parseFloat(s)
    return isNaN(value) ? undefined : value
}

// todo: add the precision param to ensure no floating point effects
export function computeRollingAverage(
    numbers: (number | undefined | null)[],
    windowSize: number,
    align: "right" | "center" = "right"
) {
    const result: (number | undefined | null)[] = []

    for (let valueIndex = 0; valueIndex < numbers.length; valueIndex++) {
        // If a value is undefined in the original input, keep it undefined in the output
        const currentVal = numbers[valueIndex]
        if (currentVal === undefined || currentVal === null) {
            result[valueIndex] = currentVal
            continue
        }

        // Take away 1 for the current value (windowSize=1 means no smoothing & no expansion)
        const expand = windowSize - 1

        // With centered smoothing, expand uneven windows asymmetrically (ceil & floor) to ensure
        // a correct number of window values get taken into account.
        // Arbitrarily biased towards left (past).
        const expandLeft = align === "center" ? Math.ceil(expand / 2) : expand
        const expandRight = align === "center" ? Math.floor(expand / 2) : 0

        const startIndex = Math.max(valueIndex - expandLeft, 0)
        const endIndex = Math.min(valueIndex + expandRight, numbers.length - 1)

        let count = 0
        let sum = 0
        for (
            let windowIndex = startIndex;
            windowIndex <= endIndex;
            windowIndex++
        ) {
            const value = numbers[windowIndex]
            if (value !== undefined && value !== null) {
                sum += value!
                count++
            }
        }

        result[valueIndex] = sum / count
    }

    return result
}

// In Grapher we return just the years for which we have values for. This puts undefineds
// in the spots where we are missing values (added to make computing rolling windows easier).
// Takes an array of value/year pairs and expands it so that there is an undefined
// for each missing value from the first year to the last year, preserving the position of
// the existing values.
export function insertMissingValuePlaceholders(
    values: number[],
    years: number[]
) {
    const startYear = years[0]
    const endYear = years[years.length - 1]
    const filledRange = []
    let year = startYear
    const map = new Map()
    years.forEach((year, index) => {
        map.set(year, index)
    })
    while (year <= endYear) {
        filledRange.push(map.has(year) ? values[map.get(year)] : null)
        year++
    }
    return filledRange
}

// Scroll Helpers
// Borrowed from: https://github.com/JedWatson/react-select/blob/32ad5c040b/packages/react-select/src/utils.js

function isDocumentElement(el: HTMLElement) {
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

export function rollingMap<T, U>(array: T[], mapper: (a: T, b: T) => U) {
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

export function linkify(s: string) {
    return linkifyHtml(s)
}

export function oneOf<T>(value: any, options: T[], defaultOption: T): T {
    for (const option of options) {
        if (value === option) return option
    }
    return defaultOption
}

export function intersectionOfSets<T>(sets: Set<T>[]) {
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

export function sortByUndefinedLast<T>(
    array: T[],
    accessor: (t: T) => string | number | undefined,
    order: SortOrder = SortOrder.asc
) {
    const sorted = sortBy(array, (value) => {
        const mapped = accessor(value)
        if (mapped === undefined) {
            return order === SortOrder.asc ? Infinity : -Infinity
        }
        return mapped
    })
    return order === SortOrder.asc ? sorted : sorted.reverse()
}

export const getErrorMessageRelatedQuestionUrl = (
    question: RelatedQuestionsConfig
): string | undefined => {
    return question.text
        ? (!question.url && "Missing URL") ||
              (!question.url.match(/^https?:\/\//) &&
                  "URL should start with http(s)://") ||
              undefined
        : undefined
}

export function getAttributesOfHTMLElement(el: HTMLElement) {
    const attributes: { [key: string]: string } = {}
    for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes.item(i)
        if (attr) attributes[attr.name] = attr.value
    }
    return attributes
}

export function mergeQueryStr(...queryStrs: (string | undefined)[]) {
    return queryParamsToStr(
        assign({}, ...excludeUndefined(queryStrs).map(strToQueryParams))
    )
}

export function mapNullToUndefined<T>(
    array: (T | undefined | null)[]
): (T | undefined)[] {
    return array.map((v) => (v === null ? undefined : v))
}

export const lowerCaseFirstLetterUnlessAbbreviation = (str: string) =>
    str.charAt(1).match(/[A-Z]/)
        ? str
        : str.charAt(0).toLowerCase() + str.slice(1)

export const getAvailableSlugSync = (
    desiredSlugName: string,
    existingSlugs: string[] | Set<string>
) => {
    existingSlugs = Array.isArray(existingSlugs)
        ? new Set(existingSlugs)
        : existingSlugs
    const originalSlug = desiredSlugName
    let num = 2
    let suffix = ""
    let slug = `${originalSlug}${suffix}`

    while (existingSlugs.has(slug)) {
        slug = `${originalSlug}${suffix}`
        suffix = "-" + num
        num++
    }

    return slug
}

/**
 * Use with caution - please note that this sort function only sorts on numeric data, and that sorts
 * **in-place** and **not stable**.
 * If you need a more general sort function that is stable and leaves the original array untouched,
 * please use lodash's `sortBy` instead. This function is faster, though.
 */
export function sortNumeric<T>(
    arr: T[],
    sortByFn: (el: T) => number = identity,
    sortOrder: SortOrder = SortOrder.asc
): T[] {
    const compareFn =
        sortOrder === SortOrder.asc
            ? (a: T, b: T) => sortByFn(a) - sortByFn(b)
            : (a: T, b: T) => sortByFn(b) - sortByFn(a)

    return arr.sort(compareFn)
}

// https://github.com/robertmassaioli/ts-is-present
// A predicate for filtering an array of nulls and undefineds that returns the correct type
export const isPresent = <T>(t: T | undefined | null | void): t is T =>
    t !== undefined && t !== null
