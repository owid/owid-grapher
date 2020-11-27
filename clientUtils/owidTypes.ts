// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export type Integer = number
export enum SortOrder {
    asc = "asc",
    desc = "desc",
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
