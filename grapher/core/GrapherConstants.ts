import { Color } from "../../coreTable/CoreTableConstants"

export enum ChartTypeName {
    LineChart = "LineChart",
    ScatterPlot = "ScatterPlot",
    TimeScatter = "TimeScatter",
    StackedArea = "StackedArea",
    DiscreteBar = "DiscreteBar",
    StackedDiscreteBar = "StackedDiscreteBar",
    SlopeChart = "SlopeChart",
    StackedBar = "StackedBar",
    WorldMap = "WorldMap",
}

export const GRAPHER_EMBEDDED_FIGURE_ATTR = "data-grapher-src"

export const GRAPHER_PAGE_BODY_CLASS = "StandaloneGrapherOrExplorerPage"

export const GRAPHER_IS_IN_IFRAME_CLASS = "IsInIframe"

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

export const BASE_FONT_SIZE = 16

export enum FacetStrategy {
    country = "country", // One chart for each country
    column = "column", // One chart for each Y column
}

export enum SeriesStrategy {
    column = "column", // One line per column
    entity = "entity", // One line per entity
}

export const ThereWasAProblemLoadingThisChart = `There was a problem loading this chart`

export type SeriesColorMap = Map<SeriesName, Color>

export enum GrapherTabOption {
    chart = "chart",
    map = "map",
    sources = "sources",
    download = "download",
    table = "table",
}

export enum ScaleType {
    linear = "linear",
    log = "log",
}

export interface HighlightToggleConfig {
    description: string
    paramStr: string
}

export interface RelatedQuestionsConfig {
    text: string
    url: string
}

export const WorldEntityName = "World"

// When a user hovers over a connected series line in a ScatterPlot we show
// a label for each point. By default that value will be from the "year" column
// but by changing this option the column used for the x or y axis could be used instead.
export enum ScatterPointLabelStrategy {
    year = "year",
    x = "x",
    y = "y",
}

export enum DimensionProperty {
    y = "y",
    x = "x",
    size = "size",
    color = "color",
    table = "table",
}

// todo: remove
export interface EntitySelection {
    entityId: number
    index: number // Which dimension the entity is from
    color?: string
}

export type SeriesName = string
