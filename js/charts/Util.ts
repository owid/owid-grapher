
import { map, sortBy, each, keys, trim, isNumber, filter, extend, isEmpty, isFinite, some, every, min, max, uniq, cloneDeep, sum, find, identity, union, debounce, includes, toString, isString, keyBy, values, flatten, groupBy, reverse, clone, reduce, noop, floor, ceil, round, toArray, throttle, has, intersection, uniqWith, without, uniqBy, capitalize, sample, sampleSize, pick, difference, sortedUniq } from 'lodash'
export { map, sortBy, each, keys, trim, isNumber, filter, extend, isEmpty, isFinite, some, every, min, max, uniq, cloneDeep, sum, find, identity, union, debounce, includes, toString, isString, keyBy, values, flatten, groupBy, reverse, clone, reduce, noop, floor, ceil, round, toArray, throttle, has, intersection, uniqWith, without, uniqBy, capitalize, sample, sampleSize, pick, difference, sortedUniq }

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

export function formatValue(value: number, options: { maxDecimalPlaces?: number, unit?: string }): string {
    const noTrailingZeroes = true
    const maxDecimalPlaces = defaultTo(options.maxDecimalPlaces, 2)
    const unit = defaultTo(options.unit, "")
    const isNoSpaceUnit = unit[0] === "%"

    let output: string = value.toString()

    const absValue = Math.abs(value)
    if (!isNoSpaceUnit && absValue >= 1e6) {
        if (absValue >= 1e12)
            output = formatValue(value / 1e12, extend({}, options, { unit: "trillion" }))
        else if (absValue >= 1e9)
            output = formatValue(value / 1e9, extend({}, options, { unit: "billion" }))
        else if (absValue >= 1e6)
            output = formatValue(value / 1e6, extend({}, options, { unit: "million" }))
    } else {
        if (maxDecimalPlaces >= 0 && value % 1 !== 0) {
            const fixed = Math.min(20, maxDecimalPlaces)
            output = format(`,.${fixed}f`)(value)
        } else {
            output = format(",")(value)
        }

        if (noTrailingZeroes) {
            const m = output.match(/([0-9,-]+.[0-9,]*?)0*$/)
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
    queryStr = queryStr || window.location.search.substring(1)
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

    if (isFinite(minValue) && isFinite(maxValue) && minValue !== maxValue) {
        return [minValue, maxValue] as [number, number]
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