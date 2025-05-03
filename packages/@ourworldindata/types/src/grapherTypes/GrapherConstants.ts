// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

/** The "plot" is a chart without any header, footer or controls */
export const IDEAL_PLOT_ASPECT_RATIO = 1.8

export const GRAPHER_MAP_TYPE = "WorldMap"

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

/**
 * The different types of Grapher tabs
 */
export const GRAPHER_TAB_TYPES = {
    table: "table",
    map: "map",
    chart: "chart",
} as const

/**
 * Grapher tab specified in the config that determines the default tab to show.
 * If `chart` is selected and Grapher has more than one chart tab, then the
 * first chart tab will be active.
 */
export const GRAPHER_TAB_OPTIONS = {
    table: "table",
    map: "map",
    chart: "chart",
    line: "line",
    slope: "slope",
} as const

/**
 * Internal tab names used in Grapher.
 */
export const GRAPHER_TAB_NAMES = {
    Table: "Table",
    WorldMap: "WorldMap",

    // chart types
    LineChart: "LineChart",
    ScatterPlot: "ScatterPlot",
    StackedArea: "StackedArea",
    DiscreteBar: "DiscreteBar",
    StackedDiscreteBar: "StackedDiscreteBar",
    SlopeChart: "SlopeChart",
    StackedBar: "StackedBar",
    Marimekko: "Marimekko",
} as const
