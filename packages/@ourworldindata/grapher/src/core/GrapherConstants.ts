import { TopicId } from "@ourworldindata/utils"
import { Color } from "@ourworldindata/core-table"
import type { GrapherProgrammaticInterface } from "./Grapher"

export enum ChartTypeName {
    LineChart = "LineChart",
    ScatterPlot = "ScatterPlot",
    StackedArea = "StackedArea",
    DiscreteBar = "DiscreteBar",
    StackedDiscreteBar = "StackedDiscreteBar",
    SlopeChart = "SlopeChart",
    StackedBar = "StackedBar",
    Marimekko = "Marimekko",

    // special map type that can't be selected by authors
    WorldMap = "WorldMap",
}

export const GRAPHER_EMBEDDED_FIGURE_ATTR = "data-grapher-src"
export const GRAPHER_EMBEDDED_FIGURE_CONFIG_ATTR = "data-grapher-config"

export const GRAPHER_PAGE_BODY_CLASS = "StandaloneGrapherOrExplorerPage"
export const GRAPHER_SETTINGS_DRAWER_ID = "grapher-settings-drawer"

export const GRAPHER_IS_IN_IFRAME_CLASS = "IsInIframe"

export const DEFAULT_GRAPHER_CONFIG_SCHEMA =
    "https://files.ourworldindata.org/schemas/grapher-schema.003.json"

export const DEFAULT_GRAPHER_ENTITY_TYPE = "country or region"
export const DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL = "countries and regions"

export const DEFAULT_GRAPHER_WIDTH = 850
export const DEFAULT_GRAPHER_HEIGHT = 600

export const DEFAULT_GRAPHER_FRAME_PADDING = 16
export const STATIC_EXPORT_DETAIL_SPACING = 8

export const GRAPHER_DARK_TEXT = "#5b5b5b"
export const GRAPHER_LIGHT_TEXT = "#858585"

export const GRAPHER_GRID_LINE_WIDTH_DEFAULT = 1
export const GRAPHER_GRID_LINE_WIDTH_THICK = 2

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

export enum MissingDataStrategy {
    auto = "auto", // pick default strategy based on chart type
    hide = "hide", // hide entities with missing data
    show = "show", // show entities with missing data
}

export const ThereWasAProblemLoadingThisChart = `There was a problem loading this chart`

export type SeriesColorMap = Map<SeriesName, Color>

export enum GrapherTabOption {
    chart = "chart",
    map = "map",
    table = "table",
}

export enum GrapherStaticFormat {
    landscape = "landscape",
    square = "square",
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

export const getVariableDataRoute = (
    dataApiUrl: string,
    variableId: number
): string => {
    if (dataApiUrl.includes("v1/indicators/")) {
        // fetching from Data API, e.g. https://api.ourworldindata.org/v1/indicators/123.data.json
        return `${dataApiUrl}${variableId}.data.json`
    } else {
        throw new Error(`dataApiUrl format not supported: ${dataApiUrl}`)
    }
}

export const getVariableMetadataRoute = (
    dataApiUrl: string,
    variableId: number
): string => {
    if (dataApiUrl.includes("v1/indicators/")) {
        // fetching from Data API, e.g. https://api.ourworldindata.org/v1/indicators/123.metadata.json
        return `${dataApiUrl}${variableId}.metadata.json`
    } else {
        throw new Error(`dataApiUrl format not supported: ${dataApiUrl}`)
    }
}

export enum Patterns {
    noDataPattern = "noDataPattern",
    noDataPatternForMapChart = "noDataPatternForMapChart",
}

export interface AnnotationFieldsInTitle {
    entity?: boolean
    time?: boolean
    changeInPrefix?: boolean
}

export const grapherInterfaceWithHiddenControlsOnly: GrapherProgrammaticInterface =
    {
        hideRelativeToggle: true,
        hideTimeline: true,
        hideFacetControl: true,
        hideEntityControls: true,
        hideZoomToggle: true,
        hideNoDataAreaToggle: true,
        hideFacetYDomainToggle: true,
        hideXScaleToggle: true,
        hideYScaleToggle: true,
        hideMapProjectionMenu: true,
        hideTableFilterToggle: true,
        map: {
            hideTimeline: true,
        },
    }

export const grapherInterfaceWithHiddenTabsOnly: GrapherProgrammaticInterface =
    {
        hasChartTab: false,
        hasMapTab: false,
        hasTableTab: false,
    }
