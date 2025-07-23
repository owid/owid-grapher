import {
    ALL_GRAPHER_CHART_TYPES,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_NAMES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherChartType,
    GrapherTabName,
    GrapherTabConfigOption,
    GrapherTabQueryParam,
} from "@ourworldindata/types"
import * as R from "remeda"
import { match } from "ts-pattern"

/**
 * Chart type combinations that are currently supported. Every subset of these
 * combinations is valid. For example, [LineChart, SlopeChart, DiscreteBar]
 * makes all these combinations valid: [LineChart, SlopeChart, DiscreteBar],
 * [LineChart, SlopeChart], [LineChart, DiscreteBar], [SlopeChart, DiscreteBar]
 *
 * This also determines the order of chart types in the UI.
 */
const VALID_CHART_TYPE_COMBINATIONS = [
    [
        GRAPHER_CHART_TYPES.LineChart,
        GRAPHER_CHART_TYPES.SlopeChart,
        GRAPHER_CHART_TYPES.DiscreteBar,
        GRAPHER_CHART_TYPES.Marimekko,
    ],
]

type ChartTabConfigOption = Exclude<
    GrapherTabConfigOption,
    "table" | "map" | "chart"
>

export const CHART_TYPE_LABEL: Record<GrapherChartType, string> = {
    [GRAPHER_CHART_TYPES.LineChart]: "Line",
    [GRAPHER_CHART_TYPES.SlopeChart]: "Slope",
    [GRAPHER_CHART_TYPES.ScatterPlot]: "Scatter",
    [GRAPHER_CHART_TYPES.StackedArea]: "Stacked area",
    [GRAPHER_CHART_TYPES.StackedBar]: "Stacked bar",
    [GRAPHER_CHART_TYPES.DiscreteBar]: "Bar",
    [GRAPHER_CHART_TYPES.StackedDiscreteBar]: "Stacked bar",
    [GRAPHER_CHART_TYPES.Marimekko]: "Marimekko",
}

export const LONG_CHART_TYPE_LABEL: Record<GrapherChartType, string> = {
    [GRAPHER_CHART_TYPES.LineChart]: "Line chart",
    [GRAPHER_CHART_TYPES.SlopeChart]: "Slope chart",
    [GRAPHER_CHART_TYPES.ScatterPlot]: "Scatter plot",
    [GRAPHER_CHART_TYPES.StackedArea]: "Stacked area chart",
    [GRAPHER_CHART_TYPES.StackedBar]: "Stacked bar chart",
    [GRAPHER_CHART_TYPES.DiscreteBar]: "Bar chart",
    [GRAPHER_CHART_TYPES.StackedDiscreteBar]: "Stacked bar chart",
    [GRAPHER_CHART_TYPES.Marimekko]: "Marimekko chart",
}

const MAP_CHART_TAB_CONFIG_OPTION_TO_CHART_TYPE_NAME: Record<
    ChartTabConfigOption,
    GrapherChartType
> = {
    [GRAPHER_TAB_CONFIG_OPTIONS.line]: GRAPHER_CHART_TYPES.LineChart,
    [GRAPHER_TAB_CONFIG_OPTIONS.slope]: GRAPHER_CHART_TYPES.SlopeChart,
    [GRAPHER_TAB_CONFIG_OPTIONS.scatter]: GRAPHER_CHART_TYPES.ScatterPlot,
    [GRAPHER_TAB_CONFIG_OPTIONS["stacked-area"]]:
        GRAPHER_CHART_TYPES.StackedArea,
    [GRAPHER_TAB_CONFIG_OPTIONS["stacked-bar"]]: GRAPHER_CHART_TYPES.StackedBar,
    [GRAPHER_TAB_CONFIG_OPTIONS["discrete-bar"]]:
        GRAPHER_CHART_TYPES.DiscreteBar,
    [GRAPHER_TAB_CONFIG_OPTIONS["stacked-discrete-bar"]]:
        GRAPHER_CHART_TYPES.StackedDiscreteBar,
    [GRAPHER_TAB_CONFIG_OPTIONS.marimekko]: GRAPHER_CHART_TYPES.Marimekko,
}

const MAP_CHART_TYPE_NAME_TO_CHART_TAB_CONFIG_OPTION = R.invert(
    MAP_CHART_TAB_CONFIG_OPTION_TO_CHART_TYPE_NAME
)

export function mapTabConfigOptionToChartTypeName(
    tabOption: ChartTabConfigOption
): GrapherChartType {
    return MAP_CHART_TAB_CONFIG_OPTION_TO_CHART_TYPE_NAME[tabOption]
}

export function mapChartTypeNameToTabConfigOption(
    chartType: GrapherChartType
): ChartTabConfigOption {
    return MAP_CHART_TYPE_NAME_TO_CHART_TAB_CONFIG_OPTION[chartType]
}

export function mapTabQueryParamToChartTypeName(
    tab: ChartTabConfigOption
): GrapherChartType {
    return MAP_CHART_TAB_CONFIG_OPTION_TO_CHART_TYPE_NAME[tab]
}

export function mapChartTypeNameToQueryParam(
    chartType: GrapherChartType
): ChartTabConfigOption {
    return MAP_CHART_TYPE_NAME_TO_CHART_TAB_CONFIG_OPTION[chartType]
}

export function mapGrapherTabNameToConfigOption(
    tabName: GrapherTabName
): GrapherTabConfigOption {
    return match(tabName)
        .with(GRAPHER_TAB_NAMES.Table, () => GRAPHER_TAB_CONFIG_OPTIONS.table)
        .with(GRAPHER_TAB_NAMES.WorldMap, () => GRAPHER_TAB_CONFIG_OPTIONS.map)
        .otherwise((tabName) => mapChartTypeNameToTabConfigOption(tabName))
}

export const mapGrapherTabNameToQueryParam = mapGrapherTabNameToConfigOption

export function makeLabelForGrapherTab(
    tab: GrapherTabName,
    options?: { useGenericChartLabel?: boolean; format?: "short" | "long" }
): string {
    const { useGenericChartLabel = false, format = "short" } = options ?? {}

    if (tab === GRAPHER_TAB_NAMES.Table) return "Table"
    if (tab === GRAPHER_TAB_NAMES.WorldMap)
        return format === "short" ? "Map" : "World map"

    if (useGenericChartLabel) return "Chart"

    return format === "short"
        ? CHART_TYPE_LABEL[tab]
        : LONG_CHART_TYPE_LABEL[tab]
}

export function findPotentialChartTypeSiblings(
    chartTypes: GrapherChartType[]
): GrapherChartType[] | undefined {
    for (const validCombination of VALID_CHART_TYPE_COMBINATIONS) {
        const validSet: Set<GrapherChartType> = new Set(validCombination)
        const hasIntersection = chartTypes.some((chartType) =>
            validSet.has(chartType)
        )
        if (hasIntersection) return validCombination
    }
    return undefined
}

export function findValidChartTypeCombination(
    chartTypes: GrapherChartType[]
): GrapherChartType[] | undefined {
    const validCombination = findPotentialChartTypeSiblings(chartTypes)
    return validCombination?.filter((chartType) =>
        chartTypes.includes(chartType)
    )
}

export function isChartTypeName(
    candidate: string
): candidate is GrapherChartType {
    return ALL_GRAPHER_CHART_TYPES.includes(candidate as any)
}

export function isValidTabQueryParam(
    candidate: string
): candidate is GrapherTabQueryParam {
    return Object.values(GRAPHER_TAB_QUERY_PARAMS).includes(candidate as any)
}

export function isValidTabConfigOption(
    candidate: string
): candidate is GrapherTabConfigOption {
    return Object.values(GRAPHER_TAB_CONFIG_OPTIONS).includes(candidate as any)
}

export const isChartTab = (tab: GrapherTabName): boolean =>
    tab !== GRAPHER_TAB_NAMES.Table && tab !== GRAPHER_TAB_NAMES.WorldMap

export const isMapTab = (tab: GrapherTabName): boolean =>
    tab === GRAPHER_TAB_NAMES.WorldMap
