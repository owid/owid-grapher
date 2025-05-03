// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

/** The "plot" is a chart without any header, footer or controls */
export const IDEAL_PLOT_ASPECT_RATIO = 1.8

export const GRAPHER_WORLD_MAP = "WorldMap"
export const GRAPHER_TABLE = "Table"

/** Chart types without WorldMap */
export const ALL_GRAPHER_CHART_TYPES = [
    "LineChart",
    "ScatterPlot",
    "StackedArea",
    "DiscreteBar",
    "StackedDiscreteBar",
    "SlopeChart",
    "StackedBar",
    "Marimekko",
] as const

/** Subset of chart types that support chart type switching */
export const GRAPHER_CHART_TYPES_SUPPORTED_FOR_SWITCHING = [
    "LineChart",
    "SlopeChart",
] as const satisfies (typeof ALL_GRAPHER_CHART_TYPES)[number][]

/**
 * Grapher tab specified in the config that specifies the default tab.
 * If `chart` is selected and Grapher has more than one chart tab, then the
 * first chart tab will be active.
 */
export const GRAPHER_TAB_CONFIG_OPTIONS = [
    "table",
    "map",
    "chart",

    // chart types
    "line",
    "slope",
] as const
