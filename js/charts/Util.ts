
import { isEqual, map, sortBy, each, keys, trim, isNumber, filter, extend, isEmpty, isFinite, some, every, min, max, uniq, cloneDeep, sum, find, identity, union, debounce, includes, toString, isString, keyBy, values, flatten, groupBy, reverse, clone, reduce, noop, floor, ceil, round, toArray, throttle, has, intersection, uniqWith, without, uniqBy, capitalize, sample, sampleSize, pick, difference, sortedUniq } from 'lodash'
export { isEqual, map, sortBy, each, keys, trim, isNumber, filter, extend, isEmpty, isFinite, some, every, min, max, uniq, cloneDeep, sum, find, identity, union, debounce, includes, toString, isString, keyBy, values, flatten, groupBy, reverse, clone, reduce, noop, floor, ceil, round, toArray, throttle, has, intersection, uniqWith, without, uniqBy, capitalize, sample, sampleSize, pick, difference, sortedUniq }

import { format } from 'd3-format'
import { extent } from 'd3-array'

import Vector2 from './Vector2'

export type SVGElement = any
export type VNode = any

export function getRelativeMouse(node: SVGElement, event: any): Vector2 {
    let clientX, clientY
    if ((event as any).clientX != null) {
        clientX = (event as MouseEvent).clientX
        clientY = (event as MouseEvent).clientY
    } else {
        clientX = (event as TouchEvent).targetTouches[0].clientX
        clientY = (event as TouchEvent).targetTouches[0].clientY
    }

    const svg = node.ownerSVGElement || node

    if (svg.createSVGPoint) {
        let point = svg.createSVGPoint()
        point.x = clientX, point.y = clientY
        point = point.matrixTransform(node.getScreenCTM().inverse())
        return new Vector2(point.x, point.y)
    }

    const rect = node.getBoundingClientRect()
    return new Vector2(clientX - rect.left - node.clientLeft, clientY - rect.top - node.clientTop)
}

// Make an arbitrary string workable as a css class name
export function makeSafeForCSS(name: string) {
    return name.replace(/[^a-z0-9]/g, s => {
        const c = s.charCodeAt(0)
        if (c === 32) return '-'
        if (c === 95) return '_'
        if (c >= 65 && c <= 90) return s
        return '__' + ('000' + c.toString(16)).slice(-4)
    })
}

// Transform entity name to match counterpart in world.ids.json
// Covers e.g. Cote d'Ivoire -> Cote_d_Ivoire
// Also removes non-ascii characters which may break datamaps
export function entityNameForMap(name: string) {
    return makeSafeForCSS(name.replace(/[ '&:\(\)\/]/g, "_"))
}

export function formatYear(year: number): string {
    if (isNaN(year)) {
        console.error(`Invalid year '${year}'`)
        return ""
    }

    if (year < 0)
        return `${Math.abs(year)} BCE`
    else
        return year.toString()
}

export function numberOnly(value: any): number | undefined {
    const num = parseFloat(value)
    if (isNaN(num))
        return undefined
    else
        return num
}

// Bind a "mobx component"
// Still working out exactly how this pattern goes
export function component<T extends { [key: string]: any }>(current: T | undefined, klass: { new(): T }, props: Partial<T>): T {
    const instance = current || new klass()
    each(keys(props), (key: string) => {
        instance[key] = props[key]
    })
    return instance
}

export function precisionRound(num: number, precision: number) {
    const factor = Math.pow(10, precision)
    return Math.round(num * factor) / factor
}

export function formatValue(value: number, options: { numDecimalPlaces?: number, unit?: string }): string {
    const noTrailingZeroes = true
    const numDecimalPlaces = defaultTo(options.numDecimalPlaces, 2)
    const unit = defaultTo(options.unit, "")
    const isNoSpaceUnit = unit[0] === "%"

    let output: string = value.toString()

    const absValue = Math.abs(value)
    if (!isNoSpaceUnit && absValue >= 1e6) {
        if (absValue >= 1e12)
            output = formatValue(value / 1e12, extend({}, options, { unit: "trillion", numDecimalPlaces: 2 }))
        else if (absValue >= 1e9)
            output = formatValue(value / 1e9, extend({}, options, { unit: "billion", numDecimalPlaces: 2 }))
        else if (absValue >= 1e6)
            output = formatValue(value / 1e6, extend({}, options, { unit: "million", numDecimalPlaces: 2 }))
    } else {
        const targetDigits = Math.pow(10, -numDecimalPlaces)

        if (value !== 0 && Math.abs(value) < targetDigits) {
            if (value < 0)
                output = `>-${targetDigits}`
            else
                output = `<${targetDigits}`
        } else {
            const rounded = precisionRound(value, numDecimalPlaces)
            output = format(`,`)(rounded)
        }

        if (noTrailingZeroes) {
            // Convert e.g. 2.200 to 2.2
            const m = output.match(/(.*?[0-9,-]+.[0-9,]*?)0*$/)
            if (m) output = m[1]
            if (output[output.length - 1] === ".")
                output = output.slice(0, output.length - 1)
        }
    }

    if (unit === "$" || unit === "£")
        output = unit + output
    else if (isNoSpaceUnit) {
        output = output + unit
    } else if (unit.length > 0) {
        output = output + " " + unit
    }

    return output
}

export function defaultTo<T, K>(value: T | undefined | null, defaultValue: K): T | K {
    if (value == null) return defaultValue
    else return value
}

export function first<T>(arr: T[]) { return arr[0] }
export function last<T>(arr: T[]) { return arr[arr.length - 1] }

export interface QueryParams { [key: string]: string|undefined }

export function getQueryParams(queryStr?: string): QueryParams {
    queryStr = queryStr || window.location.search
    if (queryStr[0] === "?")
        queryStr = queryStr.substring(1)

    const querySplit = filter(queryStr.split("&"), s => !isEmpty(s))
    const params: QueryParams = {}

    for (const param of querySplit) {
        const pair = param.split("=")
        params[pair[0]] = pair[1]
    }

    return params
}

export function queryParamsToStr(params: QueryParams) {
    let newQueryStr = ""

    each(params, (v, k) => {
        if (v === undefined) return

        if (isEmpty(newQueryStr)) newQueryStr += "?"
        else newQueryStr += "&"
        newQueryStr += k + '=' + v
    })

    return newQueryStr
}

export function setQueryVariable(key: string, val: string | null) {
    const params = getQueryParams()

    if (val === null || val === "") {
        delete params[key]
    } else {
        params[key] = val
    }

    setQueryStr(queryParamsToStr(params))
}

export function setQueryStr(str: string) {
    history.replaceState(null, document.title, window.location.pathname + str + window.location.hash)
}

// Calculate the extents of a set of numbers, with safeguards for log scales
export function domainExtent(numValues: number[], scaleType: 'linear' | 'log'): [number, number] {
    const filterValues = scaleType === 'log' ? numValues.filter(v => v > 0) : numValues
    const [minValue, maxValue] = extent(filterValues)

    if (minValue !== undefined && maxValue !== undefined && isFinite(minValue) && isFinite(maxValue)) {
        if (minValue !== maxValue) {
            return [minValue, maxValue]
        } else {
            // Only one value, make up a reasonable default
            return scaleType === 'log' ? [minValue/10, minValue*10] : [minValue-1, maxValue+1]
        }
    } else {
        return scaleType === 'log' ? [1, 100] : [-1, 1]
    }
}

// Take an arbitrary string and turn it into a nice url slug
export function slugify(s: string) {
    s = s.toLowerCase().replace(/\s*\*.+\*/, '').replace(/[^\w- ]+/g, '')
    return trim(s).replace(/ +/g, '-')
}

export function findClosest(numValues: number[], targetValue: number): number | undefined {
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
        if (i === 0)
            path += `M${points[i][0]} ${points[i][1]}`
        else
            path += `L${points[i][0]} ${points[i][1]}`
    }
    return path
}

export function defaultWith<T>(value: T|undefined, defaultFunc: () => T): T {
    return value !== undefined ? value : defaultFunc()
}

export function keysOf<T, K extends keyof T>(obj: T): K[] {
    return Object.keys(obj) as K[]
}

// Based on https://stackoverflow.com/a/30245398/1983739
// In case of tie returns higher value
export function sortedFindClosestIndex(array: number[], value: number): number {
    if (array.length === 0)
        return -1

    if (value < array[0])
        return 0

    if (value > array[array.length-1])
        return array.length-1

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
    return (array[lo] - value) < (value - array[hi]) ? lo : hi
}

export function isMobile() {
    return window.navigator.userAgent.toLowerCase().includes("mobi")
}

export function isTouchDevice() {
    return !!('ontouchstart' in window)
}

// General type reperesenting arbitrary json data; basically a non-nullable 'any'
export interface Json {
    [x: string]: any
}