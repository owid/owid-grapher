import {
    EntityName,
    GRAPHER_CHART_TYPES,
    GrapherChartType,
} from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import { defaultGrapherConfig } from "../schema/defaultGrapherConfig.js"
import type { GrapherProgrammaticInterface } from "./Grapher"

export const GRAPHER_PROD_URL = "https://ourworldindata.org"

export const GRAPHER_EMBEDDED_FIGURE_ATTR = "data-grapher-src"
export const GRAPHER_EMBEDDED_FIGURE_CONFIG_ATTR = "data-grapher-config"

export const GRAPHER_NARRATIVE_CHART_CONFIG_FIGURE_ATTR =
    "data-grapher-narrative-chart-config"

export const GRAPHER_ROUTE_FOLDER = "grapher"

export const GRAPHER_PAGE_BODY_CLASS = "StandaloneGrapherOrExplorerPage"
export const GRAPHER_IS_IN_IFRAME_CLASS = "IsInIframe"
export const GRAPHER_TIMELINE_CLASS = "timeline-component"
export const GRAPHER_SIDE_PANEL_CLASS = "side-panel"
export const GRAPHER_SETTINGS_CLASS = "settings-menu-contents"

// The Figma plugin uses these class names to identify sections of the chart
export const GRAPHER_CHART_AREA_CLASS = "chart-area"
export const GRAPHER_HEADER_CLASS = "header"
export const GRAPHER_FOOTER_CLASS = "footer"

export const DEFAULT_GRAPHER_ENTITY_TYPE = "country or region"
export const DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL = "countries and regions"

export const GRAPHER_LOADED_EVENT_NAME = "grapherLoaded"

export const DEFAULT_GRAPHER_WIDTH = 850
export const DEFAULT_GRAPHER_HEIGHT = 600

// Keep in sync with $grapher-thumbnail-width and $grapher-thumbnail-height in Grapher.scss
export const GRAPHER_THUMBNAIL_WIDTH = 300
export const GRAPHER_THUMBNAIL_HEIGHT = 160

export const GRAPHER_SQUARE_SIZE = 540

export const DEFAULT_GRAPHER_BOUNDS = new Bounds(
    0,
    0,
    DEFAULT_GRAPHER_WIDTH,
    DEFAULT_GRAPHER_HEIGHT
)

export const DEFAULT_GRAPHER_BOUNDS_SQUARE = new Bounds(
    0,
    0,
    GRAPHER_SQUARE_SIZE,
    GRAPHER_SQUARE_SIZE
)

export const GRAPHER_FRAME_PADDING_VERTICAL = 16
export const GRAPHER_FRAME_PADDING_HORIZONTAL = 16

export const STATIC_EXPORT_DETAIL_SPACING = 8

export const GRAPHER_OPACITY_MUTE = 0.3

export const GRAPHER_AREA_OPACITY_DEFAULT = 0.8
export const GRAPHER_AREA_OPACITY_MUTE = GRAPHER_OPACITY_MUTE
export const GRAPHER_AREA_OPACITY_FOCUS = 1

export const GRAPHER_TEXT_OUTLINE_FACTOR = 0.25

export const BASE_FONT_SIZE = 16

export const GRAPHER_FONT_SCALE_9_6 = 9.6 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_10 = 10 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_10_5 = 10.5 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_11 = 11 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_11_2 = 11.2 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_12 = 12 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_12_8 = 12.8 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_13 = 13 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_14 = 14 / BASE_FONT_SIZE

// keep in sync with $max-tooltip-width in Tooltip.scss
export const GRAPHER_MAX_TOOLTIP_WIDTH = 400

export const latestGrapherConfigSchema = defaultGrapherConfig.$schema

export enum CookieKey {
    isAdmin = "isAdmin",
}

export const WORLD_ENTITY_NAME = "World"

export const isWorldEntityName = (entityName: EntityName): boolean =>
    entityName === WORLD_ENTITY_NAME

export const CONTINENTS_INDICATOR_ID = 900801 // "Countries Continent"
export const POPULATION_INDICATOR_ID_USED_IN_ADMIN = 953899 // "Population (various sources, 2024-07-15)"
export const POPULATION_INDICATOR_ID_USED_IN_ENTITY_SELECTOR = 953903 // "Population (historical) (various sources, 2024-07-15)"
export const GDP_PER_CAPITA_INDICATOR_ID_USED_IN_ENTITY_SELECTOR = 900793 // "GDP per capita - Maddison Project Database (2024-04-26)"

export const isContinentsVariableId = (id: string | number): boolean =>
    id.toString() === CONTINENTS_INDICATOR_ID.toString()

// ETL paths are composed of channel/namespace/version/dataset/table#columnname
// We want to identify the any version of these two columns (added whitespaces for readability):
// grapher / demography / ANY VERSION / population / population # population
// grapher / demography / ANY VERSION / population / historical # population_historical
const population_regex =
    /^grapher\/demography\/[\d-]+\/population\/(population#population|historical#population_historical)$/

/**
 * Manually configured list of sources that define geographic regions.
 *
 * By convention, entities are named with the format 'RegionName (Source)',
 * such as 'Africa (UN)' or 'Africa (FAO)'.
 *
 * These source identifiers are used to compile group of regions for the
 * filter dropdown in the entity selector and on the data tab.
 *
 * Ideally, all regions would be defined in the ETL's regions file,
 * but currently we need to maintain this manual configuration until the
 * regions file is more complete.
 */
export const CUSTOM_REGION_SOURCE_IDS = [
    "un",
    "fao",
    "ei",
    "pip",
    "ember",
    "gcp",
    "niaid",
    "unicef",
    "unaids",
    "undp",
    "wid",
    "oecd",
] as const

export const isPopulationVariableETLPath = (path: string): boolean => {
    return population_regex.test(path)
}

export enum Patterns {
    noDataPattern = "noDataPattern",
    noDataPatternForMap = "noDataPatternForMap",
    noDataPatternForGlobe = "noDataPatternForGlobe",
    projectedDataPattern = "projectedDataPattern",
    projectedDataPatternForLegend = "projectedDataPatternForLegend",
}

export const grapherInterfaceWithHiddenControls: GrapherProgrammaticInterface =
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
        hideMapRegionDropdown: true,
        map: {
            hideTimeline: true,
        },
    }

export const grapherInterfaceWithHiddenTabs: GrapherProgrammaticInterface = {
    hasMapTab: false,
    hasTableTab: false,
    hideChartTabs: true,
}

export const SVG_STYLE_PROPS: React.CSSProperties = {
    fontFamily:
        "Lato, 'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif",
    fontFeatureSettings: '"liga", "kern", "calt", "lnum"', // keep in sync with typography.scss$default-font-features
    textRendering: "geometricPrecision",
    WebkitFontSmoothing: "antialiased",
}

export enum GrapherModal {
    Sources = "sources",
    Download = "download",
    Embed = "embed",
}

export const CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME: GrapherChartType[] =
    [GRAPHER_CHART_TYPES.LineChart, GRAPHER_CHART_TYPES.SlopeChart]
