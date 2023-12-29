import { Integer } from "../domainTypes/Various.js"

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

// TODO: remove duplicate definition, also available in CoreTable
export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export enum SortBy {
    custom = "custom",
    entityName = "entityName",
    column = "column",
    total = "total",
}

export interface SortConfig {
    sortBy?: SortBy
    sortOrder?: SortOrder
    sortColumnSlug?: string
}

export type Year = Integer
export type Color = string

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer
export type TimeRange = [Time, Time]

export type PrimitiveType = number | string | boolean
export type ValueRange = [number, number]

export enum ScaleType {
    linear = "linear",
    log = "log",
}

export interface Annotation {
    entityName?: string
    year?: number
}
export enum KeyChartLevel {
    None = 0, // not a key chart, will not show in the all charts block of the related topic page
    Bottom = 1, // chart will show at the bottom of the all charts block
    Middle = 2, // chart will show in the middle of the all charts block
    Top = 3, // chart will show at the top of the all charts block
}

export interface BasicChartInformation {
    title: string
    slug: string
    variantName?: string | null
}
export interface RelatedChart extends BasicChartInformation {
    keyChartLevel?: KeyChartLevel
}
export enum DimensionProperty {
    y = "y",
    x = "x",
    size = "size",
    color = "color",
    table = "table",
}

// see CoreTableConstants.ts
export type ColumnSlug = string // a url friendly name for a column in a table. cannot have spaces

/**
 * An unbounded value (±Infinity) or a concrete point in time (year or date).
 */
export type TimeBound = number

export type TimeBounds = [TimeBound, TimeBound]

/**
 * The two special TimeBound values: unbounded left & unbounded right.
 */
export enum TimeBoundValue {
    negativeInfinity = -Infinity,
    positiveInfinity = Infinity,
}

/**
 * Time tolerance strategy used for maps
 */
export enum ToleranceStrategy {
    closest = "closest",
    backwards = "backwards",
    forwards = "forwards",
}
