import {
    capitalize,
    ceil,
    clone,
    cloneDeep,
    compact,
    debounce,
    difference,
    each,
    entries,
    every,
    extend,
    filter,
    find,
    flatten,
    floor,
    groupBy,
    has,
    identity,
    includes,
    intersection,
    isEmpty,
    isEqual,
    isFinite,
    isNumber,
    isString,
    keyBy,
    keys,
    map,
    max,
    min,
    noop,
    omit,
    orderBy,
    pick,
    reduce,
    reverse,
    round,
    sample,
    sampleSize,
    some,
    sortBy,
    sortedUniq,
    sum,
    sumBy,
    throttle,
    toArray,
    toString,
    trim,
    union,
    uniq,
    uniqBy,
    uniqWith,
    values,
    without
} from "lodash"
export {
    isEqual,
    map,
    sortBy,
    orderBy,
    each,
    keys,
    entries,
    trim,
    isNumber,
    filter,
    extend,
    isEmpty,
    isFinite,
    some,
    every,
    min,
    max,
    compact,
    uniq,
    cloneDeep,
    sum,
    sumBy,
    find,
    identity,
    union,
    debounce,
    includes,
    toString,
    isString,
    keyBy,
    values,
    flatten,
    groupBy,
    reverse,
    clone,
    reduce,
    noop,
    floor,
    ceil,
    round,
    toArray,
    throttle,
    has,
    intersection,
    uniqWith,
    without,
    uniqBy,
    capitalize,
    sample,
    sampleSize,
    pick,
    omit,
    difference,
    sortedUniq
}

import { extent } from "d3-array"
import { format } from "d3-format"
import * as striptags from "striptags"

import { TickFormattingOptions } from "./TickFormattingOptions"
import { Vector2 } from "./Vector2"

export type SVGElement = any
export type VNode = any

interface TouchListLike {
    [index: number]: {
        clientX: number
        clientY: number
    }
}

export function getAbsoluteMouse(
    event:
        | { clientX: number; clientY: number }
        | { targetTouches: TouchListLike }
): Vector2 {
    let clientX, clientY
    if ((event as any).clientX != null) {
        clientX = (event as any).clientX
        clientY = (event as any).clientY
    } else {
        clientX = (event as any).targetTouches[0].clientX
        clientY = (event as any).targetTouches[0].clientY
    }

    return new Vector2(clientX, clientY)
}

export function getRelativeMouse(
    node: SVGElement,
    event:
        | { clientX: number; clientY: number }
        | { targetTouches: TouchListLike }
): Vector2 {
    let clientX, clientY
    if ((event as any).clientX != null) {
        clientX = (event as any).clientX
        clientY = (event as any).clientY
    } else {
        clientX = (event as any).targetTouches[0].clientX
        clientY = (event as any).targetTouches[0].clientY
    }

    const svg = node.ownerSVGElement || node

    if (svg.createSVGPoint) {
        let point = svg.createSVGPoint()
        ;(point.x = clientX), (point.y = clientY)
        point = point.matrixTransform(node.getScreenCTM().inverse())
        return new Vector2(point.x, point.y)
    }

    const rect = node.getBoundingClientRect()
    return new Vector2(
        clientX - rect.left - node.clientLeft,
        clientY - rect.top - node.clientTop
    )
}

// Make an arbitrary string workable as a css class name
export function makeSafeForCSS(name: string) {
    return name.replace(/[^a-z0-9]/g, s => {
        const c = s.charCodeAt(0)
        if (c === 32) return "-"
        if (c === 95) return "_"
        if (c >= 65 && c <= 90) return s
        return "__" + ("000" + c.toString(16)).slice(-4)
    })
}

// Transform OWID entity name to match map topology
// Since we standardized the map topology, this is just a placeholder
export function entityNameForMap(name: string) {
    return name //return makeSafeForCSS(name.replace(/[ '&:\(\)\/]/g, "_"))
}

export function formatYear(year: number): string {
    if (isNaN(year)) {
        console.warn(`Invalid year '${year}'`)
        return ""
    }

    if (year < 0) return `${Math.abs(year)} BCE`
    else return year.toString()
}

export function numberOnly(value: any): number | undefined {
    const num = parseFloat(value)
    if (isNaN(num)) return undefined
    else return num
}

// Bind a "mobx component"
// Still working out exactly how this pattern goes
// export function component<T extends { [key: string]: any }>(current: T | undefined, klass: { new(): T }, props: Partial<T>): T {
//     const instance = current || new klass()
//     each(keys(props), (key: string) => {
//         instance[key] = props[key]
//     })
//     return instance
// }

export function precisionRound(num: number, precision: number) {
    const factor = Math.pow(10, precision)
    return Math.round(num * factor) / factor
}

export function formatValue(
    value: number,
    options: TickFormattingOptions
): string {
    const noTrailingZeroes = defaultTo(options.noTrailingZeroes, true)
    const numDecimalPlaces = defaultTo(options.numDecimalPlaces, 2)
    const unit = defaultTo(options.unit, "")
    const isNoSpaceUnit = unit[0] === "%"

    let output: string = value.toString()

    const absValue = Math.abs(value)
    if (!isNoSpaceUnit && absValue >= 1e6) {
        if (!isFinite(absValue)) output = "Infinity"
        else if (absValue >= 1e12)
            output = formatValue(
                value / 1e12,
                extend({}, options, { unit: "trillion", numDecimalPlaces: 2 })
            )
        else if (absValue >= 1e9)
            output = formatValue(
                value / 1e9,
                extend({}, options, { unit: "billion", numDecimalPlaces: 2 })
            )
        else if (absValue >= 1e6)
            output = formatValue(
                value / 1e6,
                extend({}, options, { unit: "million", numDecimalPlaces: 2 })
            )
    } else {
        const targetDigits = Math.pow(10, -numDecimalPlaces)

        if (value !== 0 && Math.abs(value) < targetDigits) {
            if (value < 0) output = `>-${targetDigits}`
            else output = `<${targetDigits}`
        } else {
            output = format(`,.${numDecimalPlaces}f`)(value)
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

export function firstOfNonEmptyArray<T>(arr: T[]): T {
    if (arr.length < 1) throw new Error("array is empty")
    return first(arr) as T
}

export function lastOfNonEmptyArray<T>(arr: T[]): T {
    if (arr.length < 1) throw new Error("array is empty")
    return last(arr) as T
}

// Calculate the extents of a set of numbers, with safeguards for log scales
export function domainExtent(
    numValues: number[],
    scaleType: "linear" | "log"
): [number, number] {
    const filterValues =
        scaleType === "log" ? numValues.filter(v => v > 0) : numValues
    const [minValue, maxValue] = extent(filterValues)

    if (
        minValue !== undefined &&
        maxValue !== undefined &&
        isFinite(minValue) &&
        isFinite(maxValue)
    ) {
        if (minValue !== maxValue) {
            return [minValue, maxValue]
        } else {
            // Only one value, make up a reasonable default
            return scaleType === "log"
                ? [minValue / 10, minValue * 10]
                : [minValue - 1, maxValue + 1]
        }
    } else {
        return scaleType === "log" ? [1, 100] : [-1, 1]
    }
}

// Take an arbitrary string and turn it into a nice url slug
export function slugify(s: string) {
    s = s
        .toLowerCase()
        .replace(/\s*\*.+\*/, "")
        .replace(/[^\w- ]+/g, "")
    return trim(s).replace(/ +/g, "-")
}

export function findClosest(
    numValues: number[],
    targetValue: number
): number | undefined {
    return sortBy(numValues, value => Math.abs(value - targetValue))[0]
}

// Unique number for this execution context
// Useful for coordinating between embeds to avoid conflicts in their ids
let n = 0
export function guid(): number {
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

export function defaultWith<T>(value: T | undefined, defaultFunc: () => T): T {
    return value !== undefined ? value : defaultFunc()
}

export function keysOf<T, K extends keyof T>(obj: T): K[] {
    return Object.keys(obj) as K[]
}

// Based on https://stackoverflow.com/a/30245398/1983739
// In case of tie returns higher value
export function sortedFindClosestIndex(array: number[], value: number): number {
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
    return window.navigator.userAgent.toLowerCase().includes("mobi")
}

export function isTouchDevice() {
    return !!("ontouchstart" in window)
}

// General type reperesenting arbitrary json data; basically a non-nullable 'any'
export interface Json {
    [x: string]: any
}

// Escape a function for storage in a csv cell
export function csvEscape(value: any): string {
    const valueStr = toString(value)
    if (includes(valueStr, ",")) return `"${value.replace(/\"/g, '""')}"`
    else return value
}

import * as parseUrl from "url-parse"

export function urlToSlug(url: string): string {
    const urlobj = parseUrl(url)
    const slug = last(urlobj.pathname.split("/").filter(x => x)) as string
    return slug
}

export function sign(n: number) {
    return n > 0 ? 1 : n < 0 ? -1 : 0
}

export async function fetchJSON(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest()
        req.addEventListener("load", function() {
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
