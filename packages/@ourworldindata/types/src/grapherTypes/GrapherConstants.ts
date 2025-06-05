// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

/** The "plot" is a chart without any header, footer or controls */
export const IDEAL_PLOT_ASPECT_RATIO = 1.8

export const GRAPHER_MAP_TYPE = "WorldMap"

export const GRAPHER_CHART_TYPES = {
    LineChart: "LineChart",
    ScatterPlot: "ScatterPlot",
    StackedArea: "StackedArea",
    DiscreteBar: "DiscreteBar",
    StackedDiscreteBar: "StackedDiscreteBar",
    SlopeChart: "SlopeChart",
    StackedBar: "StackedBar",
    Marimekko: "Marimekko",
} as const

export const ALL_GRAPHER_CHART_TYPES = Object.values(GRAPHER_CHART_TYPES)

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
    "discrete-bar": "discrete-bar",
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

/**
 * Valid values for the `tab` query parameter in Grapher.
 */
export const GRAPHER_TAB_QUERY_PARAMS = {
    // generic params
    table: "table",
    map: "map",
    chart: "chart",

    // chart types
    line: "line",
    scatter: "scatter",
    "stacked-area": "stacked-area",
    "discrete-bar": "discrete-bar",
    "stacked-discrete-bar": "stacked-discrete-bar",
    slope: "slope",
    "stacked-bar": "stacked-bar",
    marimekko: "marimekko",
} as const
