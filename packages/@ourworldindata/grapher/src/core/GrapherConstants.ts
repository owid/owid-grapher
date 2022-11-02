import { TopicId } from "@ourworldindata/utils"
import { Color } from "@ourworldindata/core-table"

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
    Marimekko = "Marimekko",
}

export const GRAPHER_EMBEDDED_FIGURE_ATTR = "data-grapher-src"

export const GRAPHER_PAGE_BODY_CLASS = "StandaloneGrapherOrExplorerPage"

export const GRAPHER_IS_IN_IFRAME_CLASS = "IsInIframe"

export const DEFAULT_GRAPHER_WIDTH = 850
export const DEFAULT_GRAPHER_HEIGHT = 600

export const STATIC_EXPORT_DETAIL_SPACING = 24

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
    none = "none", // No facets
    entity = "entity", // One chart for each country/entity
    metric = "metric", // One chart for each Y column
}

export enum FacetAxisDomain {
    independent = "independent", // all facets have their own y domain
    // TODO: rename to "uniform", since "shared" has a different meaning when
    // axes are being plotted (it means the axis is omitted).
    // Need to migrate Grapher & Explorer configs.
    shared = "shared", // all facets share the same y domain
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

export interface RelatedQuestionsConfig {
    text: string
    url: string
}

export interface Topic {
    id: TopicId
    name: string
}

export interface Detail {
    category: string
    term: string
    title: string
    content: string
    id: number
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

export type SeriesName = string

export const GRAPHER_VARIABLES_ROUTE = "/grapher/data/variables"
export const GRAPHER_VARIABLE_DATA_ROUTE = `${GRAPHER_VARIABLES_ROUTE}/data`
export const GRAPHER_VARIABLE_METADATA_ROUTE = `${GRAPHER_VARIABLES_ROUTE}/metadata`

export const getVariableDataRoute = (variableId: number): string =>
    `${GRAPHER_VARIABLE_DATA_ROUTE}/${variableId}.json`

export const getVariableMetadataRoute = (variableId: number): string =>
    `${GRAPHER_VARIABLE_METADATA_ROUTE}/${variableId}.json`

export enum Patterns {
    noDataPattern = "noDataPattern",
    noDataPatternForMapChart = "noDataPatternForMapChart",
}
