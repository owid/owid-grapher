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
import { isSubsetOf } from "@ourworldindata/utils"
import * as R from "remeda"

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

export function findPotentialChartTypeSiblings(
    chartTypeSet: Set<GrapherChartType>
): GrapherChartType[] | undefined {
    for (const validCombination of VALID_CHART_TYPE_COMBINATIONS) {
        const validCombinationSet = new Set(validCombination)
        if (isSubsetOf(chartTypeSet, validCombinationSet))
            return validCombination
    }
    return undefined
}

export function findValidChartTypeCombination(
    chartTypeSet: Set<GrapherChartType>
): GrapherChartType[] | undefined {
    const validCombination = findPotentialChartTypeSiblings(chartTypeSet)
    return validCombination?.filter((chartType) => chartTypeSet.has(chartType))
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
