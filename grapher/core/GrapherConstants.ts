export enum ChartTypeName {
    LineChart = "LineChart",
    ScatterPlot = "ScatterPlot",
    TimeScatter = "TimeScatter",
    StackedArea = "StackedArea",
    DiscreteBar = "DiscreteBar",
    SlopeChart = "SlopeChart",
    StackedBar = "StackedBar",
    WorldMap = "WorldMap",
}

export enum CookieKey {
    isAdmin = "isAdmin",
}

// We currently have the notion of "modes", where you can either select 1 entity, or select multiple entities, or not change the selection at all.
// Todo: can we remove?
export enum EntitySelectionMode {
    MultipleEntities = "add-country",
    SingleEntity = "change-country",
    Disabled = "disabled",
}

export enum StackMode {
    absolute = "absolute",
    relative = "relative",
}

// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

export const BASE_FONT_SIZE = 16

export type Integer = number
/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer
export type TimeTolerance = Integer

export type TimeRange = [Time, Time]
export type ValueRange = [number, number]

export enum FacetStrategy {
    country = "country", // One chart for each country
    column = "column", // One chart for each Y column
    columnWithMap = "columnWithMap", // One chart and one map for each Y column
    countryWithMap = "countryWithMap", // One chart for each country. One map for each Y Column
}

export enum SeriesStrategy {
    column = "column", // One line per column
    entity = "entity", // One line per entity
}

// A measurement value. Example: For "A GDP of 200" the CellValue is 200.
export type CellValue = number | string

export enum GrapherTabOption {
    chart = "chart",
    map = "map",
    sources = "sources",
    download = "download",
    table = "table",
}

export type Color = string

export enum ScaleType {
    linear = "linear",
    log = "log",
}

export interface ScaleTypeConfig {
    scaleType: ScaleType
    scaleTypeOptions: ScaleType[]
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
export enum ScatterPointLabelStrategy {
    year = "year",
    x = "x",
    y = "y",
}

export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export enum DimensionProperty {
    y = "y",
    x = "x",
    size = "size",
    color = "color",
    table = "table",
}

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

export type SeriesName = string
