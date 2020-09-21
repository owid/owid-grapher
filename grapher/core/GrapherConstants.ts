export enum ChartTypes {
    LineChart = "LineChart",
    ScatterPlot = "ScatterPlot",
    TimeScatter = "TimeScatter",
    StackedArea = "StackedArea",
    DiscreteBar = "DiscreteBar",
    SlopeChart = "SlopeChart",
    StackedBar = "StackedBar",
}

export type ChartTypeName = keyof typeof ChartTypes

export enum CookieKeys {
    isAdmin = "isAdmin",
}

export type AddCountryMode = "add-country" | "change-country" | "disabled"

export type StackMode = "absolute" | "relative"

// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

export const BASE_FONT_SIZE = 16

export type Integer = number
/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer

export type TimeRange = [Time, Time]
export type ValueRange = [number, number]

// A measurement value. Example: For "A GDP of 200" the CellValue is 200.
export type CellValue = number | string

export interface OverlayPadding {
    top: number
    right: number
    bottom: number
    left: number
}

export type GrapherTabOption =
    | "chart"
    | "map"
    | "sources"
    | "download"
    | "table"

export type Color = string

export enum ScaleType {
    linear = "linear",
    log = "log",
}

export interface ScaleTypeConfig {
    scaleType: ScaleType
    scaleTypeOptions: ScaleType[]
    updateChartScaleType: (scaleType: ScaleType) => void
}

export interface HighlightToggleConfig {
    description: string
    paramStr: string
}

export interface RelatedQuestionsConfig {
    text: string
    url: string
}

// When a user hovers over a connected series line in a ScatterPlot we show
// a label for each point. By default that value will be from the "year" column
// but by changing this option the column used for the x or y axis could be used instead.
export declare type ScatterPointLabelStrategy = "year" | "x" | "y"

export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export declare type DimensionProperty = "y" | "x" | "size" | "color" | "table"

export interface TickFormattingOptions {
    numDecimalPlaces?: number
    unit?: string
    noTrailingZeroes?: boolean
    noSpaceUnit?: boolean
    numberPrefixes?: boolean
    shortNumberPrefixes?: boolean
    showPlus?: boolean
    isFirstOrLastTick?: boolean
}

// todo: remove
export interface EntitySelection {
    entityId: number
    index: number // Which dimension the entity is from
    color?: Color
}
