import {
    ALL_GRAPHER_CHART_TYPES,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_OPTIONS,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherChartType,
    GrapherTabOption,
    GrapherTabQueryParam,
} from "@ourworldindata/types"
import { validChartTypeCombinations } from "../core/GrapherConstants"
import { isSubsetOf } from "@ourworldindata/utils"

type ChartTabOption = Exclude<GrapherTabOption, "table" | "map" | "chart">

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

const MAP_CHART_TAB_OPTION_TO_NAME: Record<ChartTabOption, GrapherChartType> = {
    [GRAPHER_TAB_OPTIONS.line]: GRAPHER_CHART_TYPES.LineChart,
    [GRAPHER_TAB_OPTIONS.slope]: GRAPHER_CHART_TYPES.SlopeChart,
    [GRAPHER_TAB_OPTIONS.scatter]: GRAPHER_CHART_TYPES.ScatterPlot,
    [GRAPHER_TAB_OPTIONS["stacked-area"]]: GRAPHER_CHART_TYPES.StackedArea,
    [GRAPHER_TAB_OPTIONS["stacked-bar"]]: GRAPHER_CHART_TYPES.StackedBar,
    [GRAPHER_TAB_OPTIONS["discrete-bar"]]: GRAPHER_CHART_TYPES.DiscreteBar,
    [GRAPHER_TAB_OPTIONS["stacked-discrete-bar"]]:
        GRAPHER_CHART_TYPES.StackedDiscreteBar,
    [GRAPHER_TAB_OPTIONS.marimekko]: GRAPHER_CHART_TYPES.Marimekko,
}

const MAP_CHART_TYPE_NAME_TO_OPTION: Record<GrapherChartType, ChartTabOption> =
    Object.fromEntries(
        Object.entries(MAP_CHART_TAB_OPTION_TO_NAME).map(([key, value]) => [
            value,
            key,
        ])
    ) as Record<GrapherChartType, ChartTabOption>

export function mapQueryParamToChartTypeName(
    tab: ChartTabOption
): GrapherChartType {
    return MAP_CHART_TAB_OPTION_TO_NAME[tab]
}

export function mapChartTypeNameToQueryParam(
    chartType: GrapherChartType
): ChartTabOption {
    return MAP_CHART_TYPE_NAME_TO_OPTION[chartType]
}

export function mapTabOptionToChartTypeName(
    tabOption: ChartTabOption
): GrapherChartType {
    return MAP_CHART_TAB_OPTION_TO_NAME[tabOption]
}

export function mapChartTypeNameToTabOption(
    chartType: GrapherChartType
): ChartTabOption {
    return MAP_CHART_TYPE_NAME_TO_OPTION[chartType]
}

export function findValidChartTypeCombination(
    chartTypeSet: Set<GrapherChartType>
): GrapherChartType[] | undefined {
    for (const validCombination of validChartTypeCombinations) {
        const validCombinationSet = new Set(validCombination)
        if (isSubsetOf(chartTypeSet, validCombinationSet))
            return validCombination.filter((chartType) =>
                chartTypeSet.has(chartType)
            )
    }
    return undefined
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

export function isValidTabOption(
    candidate: string
): candidate is GrapherTabOption {
    return Object.values(GRAPHER_TAB_OPTIONS).includes(candidate as any)
}
