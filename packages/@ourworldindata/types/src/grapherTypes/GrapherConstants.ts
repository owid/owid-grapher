// todo: remove when we ditch Year and YearIsDay
export const EPOCH_DATE = "2020-01-21"

/** The "plot" is a chart without any header, footer or controls */
export const IDEAL_PLOT_ASPECT_RATIO = 1.8

/** Chart types without WorldMap */
export const GRAPHER_CHART_TYPES = [
    "LineChart",
    "ScatterPlot",
    "StackedArea",
    "DiscreteBar",
    "StackedDiscreteBar",
    "SlopeChart",
    "StackedBar",
    "Marimekko",
] as const

/** Subset of chart types supported for chart type switching */
export const GRAPHER_CHART_TYPES_SUPPORTED_FOR_SWITCHING = [
    "LineChart",
    "SlopeChart",
    "DiscreteBar",
] as const satisfies (typeof GRAPHER_CHART_TYPES)[number][]

/** Valid values for the `tab` field in Grapher configs */
export const GRAPHER_TAB_CONFIG_OPTIONS = [
    "Table",
    "WorldMap",
    "Chart",

    ...GRAPHER_CHART_TYPES_SUPPORTED_FOR_SWITCHING,
] as const

/** Valid values for the `tab` query parameter */
export const GRAPHER_TAB_QUERY_PARAMS = [
    "table",
    "map",
    "chart",

    // chart types
    "line",
    "slope",
    "discrete-bar",
] as const
